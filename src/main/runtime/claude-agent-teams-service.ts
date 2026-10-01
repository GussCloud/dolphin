import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { splitTmuxCommand } from '../../shared/claude-agent-teams-tmux-compat'
import { ClaudeAgentTeamsTmuxDispatcher } from './claude-agent-teams-tmux-dispatcher'
import { resolvePathEnvKey } from '../pty/windows-environment-path'
import { AGENT_TEAMS_SHIM_PATH_DIRS_ENV } from '../claude-agent-teams-path-restore'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'
import type {
  AgentTeam,
  AgentTeamsLaunchEnv,
  AgentTeamsTerminalApi,
  AgentTeamsTmuxCompatRequest,
  AgentTeamsTmuxCompatResponse,
  TeamPane
} from './claude-agent-teams-types'

export type {
  AgentTeamsLaunchEnv,
  AgentTeamsTerminalApi,
  AgentTeamsTmuxCompatRequest,
  AgentTeamsTmuxCompatResponse
} from './claude-agent-teams-types'

export class ClaudeAgentTeamsService {
  private readonly teams = new Map<string, AgentTeam>()
  private readonly dispatcher = new ClaudeAgentTeamsTmuxDispatcher()
  private pipeEndpoint: string | null = null

  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  /** Agent-teams-only named pipe that tmux.exe calls directly; null when no listener is up. */
  setPipeEndpoint(endpoint: string | null): void {
    this.pipeEndpoint = endpoint
  }

  createLaunchEnv(args: {
    leaderHandle: string
    baseEnv: Record<string, string | undefined>
    shimDir: string
    /** Absolute path only; null leaves the var unset so the shim refuses to guess a cwd-relative CLI. */
    shimBin: string | null
    /** PATH dirs to prepend, highest precedence first; defaults to just `shimDir`. */
    shimPathDirs?: string[]
    /** Omitted when the leader PTY is not spawned yet; resolved on the first teammate split. */
    hostShell?: AgentTeamHostShell
  }): AgentTeamsLaunchEnv {
    const teamId = `team-${randomUUID()}`
    const token = randomBytes(32).toString('base64url')
    const leaderPane = '%1'
    // Why: Windows callers pass an env spelt `Path`; reading `PATH` there truncated the launch PATH to just the shim dir.
    const pathKey = resolvePathEnvKey(args.baseEnv, process.platform)
    const pathDelimiter = process.platform === 'win32' ? ';' : ':'
    const shimPathDirs = (args.shimPathDirs ?? [args.shimDir]).filter(Boolean)
    const pathValue = [...shimPathDirs, args.baseEnv[pathKey]].filter(Boolean).join(pathDelimiter)
    const tmuxValue = `/tmp/dolphin-claude-agent-teams/${teamId},0,1`
    const env: Record<string, string> = {
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
      [pathKey]: pathValue,
      TMUX: tmuxValue,
      TMUX_PANE: leaderPane,
      TERM: 'screen-256color',
      COLORTERM: args.baseEnv.COLORTERM || 'truecolor',
      DOLPHIN_AGENT_TEAMS_TEAM_ID: teamId,
      DOLPHIN_AGENT_TEAMS_TOKEN: token,
      DOLPHIN_AGENT_TEAMS_LEADER_PANE: leaderPane,
      DOLPHIN_AGENT_TEAMS_SHIM_DIR: args.shimDir,
      // Why: pane shells re-lead PATH after profile scripts; the ordered list keeps tmux.exe ahead of tmux.cmd.
      [AGENT_TEAMS_SHIM_PATH_DIRS_ENV]: shimPathDirs.join(pathDelimiter)
    }
    if (args.shimBin) {
      env.DOLPHIN_AGENT_TEAMS_SHIM_BIN = args.shimBin
    }
    if (args.baseEnv.DOLPHIN_PAIRING_CODE) {
      env.DOLPHIN_PAIRING_CODE = args.baseEnv.DOLPHIN_PAIRING_CODE
    }
    if (args.baseEnv.DOLPHIN_ENVIRONMENT) {
      env.DOLPHIN_ENVIRONMENT = args.baseEnv.DOLPHIN_ENVIRONMENT
    }
    // Why: pairing/environment routes the shim to a remote runtime; this local pipe would bypass it.
    const routesRemote = Boolean(env.DOLPHIN_PAIRING_CODE || env.DOLPHIN_ENVIRONMENT)
    if (this.platform === 'win32' && this.pipeEndpoint && !routesRemote) {
      env.DOLPHIN_AGENT_TEAMS_ENDPOINT = this.pipeEndpoint
    }

    const leader: TeamPane = { fakePaneId: leaderPane, handle: args.leaderHandle, index: 0 }
    this.teams.set(teamId, {
      teamId,
      token,
      leaderPane,
      leaderHandle: args.leaderHandle,
      sessionName: 'dolphin',
      windowIndex: '0',
      tmuxValue,
      baseEnv: env,
      hostShell: args.hostShell ?? null,
      panes: new Map([[leaderPane, leader]]),
      paneOrder: [leaderPane],
      nextPaneNumber: 2,
      mainVertical: null,
      previouslyFocusedPane: null
    })
    return { teamId, token, leaderPane, env }
  }

  removeTeamForLeaderHandle(handle: string): void {
    for (const [teamId, team] of this.teams) {
      if (team.leaderHandle === handle) {
        this.teams.delete(teamId)
        void this.dispatcher.releaseTeam(team)
      }
    }
  }

  getActiveTeamCount(): number {
    return this.teams.size
  }

  async handleTmuxCompat(
    request: AgentTeamsTmuxCompatRequest,
    api: AgentTeamsTerminalApi
  ): Promise<AgentTeamsTmuxCompatResponse> {
    try {
      const team = this.resolveTeam(request)
      const { command, args } = splitTmuxCommand(request.argv)
      const stdout = await this.dispatcher.dispatch(team, command, args, request.envPane, api)
      return { ok: true, stdout, stderr: '', exitCode: 0 }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, stdout: '', stderr: `tmux: ${message}\n`, exitCode: 1 }
    }
  }

  private resolveTeam(request: AgentTeamsTmuxCompatRequest): AgentTeam {
    const team = this.teams.get(request.teamId)
    if (!team || !tokensMatch(team.token, request.token)) {
      throw new Error('stale or unauthorized agent team')
    }
    if (!team.panes.has(request.envPane)) {
      throw new Error(`unknown pane: ${request.envPane}`)
    }
    return team
  }
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8')
  const actualBytes = Buffer.from(actual, 'utf8')
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}
