import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { splitTmuxCommand } from '../../shared/claude-agent-teams-tmux-compat'
import { ClaudeAgentTeamsTmuxDispatcher } from './claude-agent-teams-tmux-dispatcher'
import { resolvePathEnvKey } from '../pty/windows-environment-path'
import { AGENT_TEAMS_SHIM_PATH_DIRS_ENV } from '../claude-agent-teams-path-restore'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'
import {
  DEEPSEEK_PROVIDER_ENV_KEY,
  DEEPSEEK_PROVIDER_ENV_VALUE,
  isDeepSeekTuiAgent
} from '../../shared/deepseek-claude-provider'
import type { ClaudeAgentTeamsLeaderRegistry } from './claude-agent-teams-leader-registry'
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
  /** Teams written to `leaderRegistry`, by team id. */
  private readonly persistedLeaderPaneKeys = new Map<string, string>()

  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly leaderRegistry: ClaudeAgentTeamsLeaderRegistry | null = null
  ) {}

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
    /** Lets the team be re-admitted after a main restart; omitted, the team dies with this process. */
    paneKey?: string
    /** DeepSeek leader: teammates get the non-secret marker; spawn resolves the key fresh. */
    deepSeekProvider?: boolean
  }): AgentTeamsLaunchEnv {
    const teamId = `team-${randomUUID()}`
    const token = randomBytes(32).toString('base64url')
    const leaderPane = '%1'
    // Why: Windows callers pass an env spelt `Path`; reading `PATH` there truncated the launch PATH to just the shim dir.
    const pathKey = resolvePathEnvKey(args.baseEnv, process.platform)
    const pathDelimiter = process.platform === 'win32' ? ';' : ':'
    const shimPathDirs = (args.shimPathDirs ?? [args.shimDir]).filter(Boolean)
    const pathValue = [...shimPathDirs, args.baseEnv[pathKey]].filter(Boolean).join(pathDelimiter)
    const tmuxValue = agentTeamTmuxValue(teamId)
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
    if (args.deepSeekProvider) {
      env[DEEPSEEK_PROVIDER_ENV_KEY] = DEEPSEEK_PROVIDER_ENV_VALUE
    }
    if (args.baseEnv.DOLPHIN_PAIRING_CODE) {
      env.DOLPHIN_PAIRING_CODE = args.baseEnv.DOLPHIN_PAIRING_CODE
    }
    if (args.baseEnv.DOLPHIN_ENVIRONMENT) {
      env.DOLPHIN_ENVIRONMENT = args.baseEnv.DOLPHIN_ENVIRONMENT
    }
    // Why: pairing/environment routes the shim to a remote runtime; this local pipe would bypass it.
    const routesRemote = routesAgentTeamToRemoteRuntime(env)
    if (this.platform === 'win32' && this.pipeEndpoint && !routesRemote) {
      env.DOLPHIN_AGENT_TEAMS_ENDPOINT = this.pipeEndpoint
    }

    const team = this.registerTeam({
      teamId,
      token,
      leaderHandle: args.leaderHandle,
      env,
      hostShell: args.hostShell ?? null,
      nextPaneNumber: 2
    })
    if (args.paneKey) {
      this.persistedLeaderPaneKeys.set(teamId, args.paneKey)
      this.persistTeam(team)
    }
    return { teamId, token, leaderPane, env }
  }

  /** Runtime-created leaders learn their shim dirs inside the launch plan. */
  createLaunchEnvFactory(args: {
    leaderHandle: string
    baseEnv: Record<string, string | undefined>
    launchAgent?: unknown
  }): (
    shimDir: string,
    shimBin: string | null,
    shimPathDirs: string[]
  ) => Record<string, string> | null {
    const deepSeekProvider = isDeepSeekTuiAgent(args.launchAgent)
    return (shimDir, shimBin, shimPathDirs) =>
      deepSeekProvider && routesAgentTeamToRemoteRuntime(args.baseEnv)
        ? null
        : this.createLaunchEnv({
            leaderHandle: args.leaderHandle,
            baseEnv: args.baseEnv,
            shimDir,
            shimBin,
            shimPathDirs,
            deepSeekProvider
          }).env
  }

  removeTeamForLeaderHandle(handle: string): void {
    for (const [teamId, team] of this.teams) {
      if (team.leaderHandle === handle) {
        this.teams.delete(teamId)
        void this.dispatcher.releaseTeam(team)
        if (this.persistedLeaderPaneKeys.delete(teamId)) {
          this.withRegistry((registry) => registry.delete(teamId))
        }
      }
    }
  }

  getActiveTeamCount(): number {
    return this.teams.size
  }

  /** Spawned teammate panes Claude titled; pending panes have no terminal to name yet. */
  listTeammateNamesByHandle(): Map<string, string> {
    const names = new Map<string, string>()
    for (const team of this.teams.values()) {
      for (const pane of team.panes.values()) {
        if (pane.handle !== null && pane.teammateName) {
          names.set(pane.handle, pane.teammateName)
        }
      }
    }
    return names
  }

  /** Spawned teammate panes and the leader terminal that owns them. */
  listTeammateLineageByHandle(): Map<string, { leaderHandle: string; teammateName?: string }> {
    const lineage = new Map<string, { leaderHandle: string; teammateName?: string }>()
    for (const team of this.teams.values()) {
      for (const pane of team.panes.values()) {
        if (pane.handle !== null && pane.handle !== team.leaderHandle) {
          lineage.set(pane.handle, {
            leaderHandle: team.leaderHandle,
            ...(pane.teammateName ? { teammateName: pane.teammateName } : {})
          })
        }
      }
    }
    return lineage
  }

  async handleTmuxCompat(
    request: AgentTeamsTmuxCompatRequest,
    api: AgentTeamsTerminalApi
  ): Promise<AgentTeamsTmuxCompatResponse> {
    let team: AgentTeam | null = null
    let paneNumberBefore = 0
    try {
      team = this.resolveTeam(request, api)
      paneNumberBefore = team.nextPaneNumber
      const { command, args } = splitTmuxCommand(request.argv)
      const stdout = await this.dispatcher.dispatch(team, command, args, request.envPane, api)
      return { ok: true, stdout, stderr: '', exitCode: 0 }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, stdout: '', stderr: `tmux: ${message}\n`, exitCode: 1 }
    } finally {
      // Why: a restored team must not re-issue a pane id the leader's Claude still remembers.
      if (
        team &&
        team.nextPaneNumber !== paneNumberBefore &&
        this.teams.get(team.teamId) === team
      ) {
        this.persistTeam(team)
      }
    }
  }

  private resolveTeam(request: AgentTeamsTmuxCompatRequest, api: AgentTeamsTerminalApi): AgentTeam {
    const team = this.teams.get(request.teamId) ?? this.restoreTeam(request, api)
    if (!team || !tokensMatch(team.token, request.token)) {
      throw new Error('stale or unauthorized agent team')
    }
    if (!team.panes.has(request.envPane)) {
      throw new Error(`unknown pane: ${request.envPane}`)
    }
    return team
  }

  // Why: an auto-update restarts main with `teams` empty while the daemon keeps leader PTYs holding the old id/token.
  private restoreTeam(
    request: AgentTeamsTmuxCompatRequest,
    api: AgentTeamsTerminalApi
  ): AgentTeam | null {
    const persisted = this.withRegistry((registry) => registry.get(request.teamId))
    if (!persisted || !tokensMatch(persisted.token, request.token)) {
      return null
    }
    // Why: not-yet-reattached is indistinguishable from dead here, so the record is kept for a later call.
    const leaderHandle = api.resolveLiveLeaderHandle?.(persisted.paneKey) ?? null
    if (!leaderHandle) {
      return null
    }
    this.persistedLeaderPaneKeys.set(persisted.teamId, persisted.paneKey)
    return this.registerTeam({
      teamId: persisted.teamId,
      token: persisted.token,
      leaderHandle,
      env: persisted.env,
      hostShell: null,
      nextPaneNumber: persisted.nextPaneNumber
    })
  }

  private registerTeam(args: {
    teamId: string
    token: string
    leaderHandle: string
    env: Record<string, string>
    hostShell: AgentTeamHostShell | null
    nextPaneNumber: number
  }): AgentTeam {
    const leaderPane = '%1'
    const leader: TeamPane = { fakePaneId: leaderPane, handle: args.leaderHandle, index: 0 }
    const team: AgentTeam = {
      teamId: args.teamId,
      token: args.token,
      leaderPane,
      leaderHandle: args.leaderHandle,
      sessionName: 'dolphin',
      windowIndex: '0',
      tmuxValue: agentTeamTmuxValue(args.teamId),
      baseEnv: args.env,
      hostShell: args.hostShell,
      panes: new Map([[leaderPane, leader]]),
      paneOrder: [leaderPane],
      nextPaneNumber: args.nextPaneNumber,
      mainVertical: null,
      previouslyFocusedPane: null
    }
    this.teams.set(args.teamId, team)
    return team
  }

  private persistTeam(team: AgentTeam): void {
    const paneKey = this.persistedLeaderPaneKeys.get(team.teamId)
    if (!paneKey) {
      return
    }
    this.withRegistry((registry) =>
      registry.save({
        teamId: team.teamId,
        token: team.token,
        paneKey,
        env: team.baseEnv,
        nextPaneNumber: team.nextPaneNumber
      })
    )
  }

  // Why: persistence only adds restart survival; a disk failure must not break the live team.
  private withRegistry<T>(run: (registry: ClaudeAgentTeamsLeaderRegistry) => T): T | null {
    if (!this.leaderRegistry) {
      return null
    }
    try {
      return run(this.leaderRegistry)
    } catch {
      return null
    }
  }
}

/**
 * True when the team's tmux shim would create teammate panes on another Dolphin runtime. A DeepSeek
 * team must not: that host may not know the marker and would start plain `claude` on the user's
 * Anthropic account, so DeepSeek leaders keep teammates in-process instead.
 */
export function routesAgentTeamToRemoteRuntime(env: Record<string, string | undefined>): boolean {
  return Boolean(env.DOLPHIN_PAIRING_CODE || env.DOLPHIN_ENVIRONMENT)
}

function agentTeamTmuxValue(teamId: string): string {
  return `/tmp/dolphin-claude-agent-teams/${teamId},0,1`
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8')
  const actualBytes = Buffer.from(actual, 'utf8')
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}
