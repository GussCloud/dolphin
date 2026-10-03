import type {
  RuntimeTerminalClose,
  RuntimeTerminalFocus,
  RuntimeTerminalRead,
  RuntimeTerminalSend,
  RuntimeTerminalShow,
  RuntimeTerminalSplit
} from '../../shared/runtime-types'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'

export type AgentTeamsTmuxCompatRequest = {
  teamId: string
  token: string
  envPane: string
  cwd?: string
  argv: string[]
}

export type AgentTeamsTmuxCompatResponse = {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number
}

export type AgentTeamsLaunchEnv = {
  teamId: string
  token: string
  leaderPane: string
  env: Record<string, string>
}

export type AgentTeamsTerminalApi = {
  splitTerminal(
    handle: string,
    opts: {
      direction?: 'horizontal' | 'vertical'
      command?: string
      env?: Record<string, string>
      envToDelete?: string[]
      activate?: boolean
      shellOverride?: string
      /** Run `command` as a Git Bash launch arg; the pane still works if the host types it. */
      gitBashStartupCommandInArgs?: boolean
    }
  ): Promise<RuntimeTerminalSplit>
  /** Null when the leader's PTY is unknown on a host where the answer matters. */
  resolveHostShell(leaderHandle: string): AgentTeamHostShell | null
  /** A resumed teammate would come back as a plain session outside its team. */
  markTeammatePaneNotResumable(handle: string): void
  readTerminal(handle: string, opts?: { limit?: number }): Promise<RuntimeTerminalRead>
  sendTerminal(
    handle: string,
    action: { text?: string; enter?: boolean; interrupt?: boolean }
  ): Promise<RuntimeTerminalSend>
  focusTerminal(handle: string): Promise<RuntimeTerminalFocus>
  closeTerminal(handle: string): Promise<RuntimeTerminalClose>
  showTerminal(handle: string): Promise<RuntimeTerminalShow>
}

export type TeamPane = {
  fakePaneId: string
  // Why: null while pending — Git Bash teams defer the real split of Claude's `-- cat`
  // holding pane until `respawn-pane` brings the teammate command.
  handle: string | null
  index: number
  // Why: Claude Code splits a holding pane (`-- cat`) then `respawn-pane`s it
  // with the real teammate command. We remember how the pane was first split so
  // respawn can recreate it in the same slot while preserving its fake pane id.
  splitFromPane?: string
  splitDirection?: 'horizontal' | 'vertical'
  respawnBlockedReason?: string
  /** Git Bash teams: the one-shot script the pane was told to source; removed if it never ran. */
  commandScriptPath?: string
}

export type AgentTeam = {
  teamId: string
  token: string
  leaderPane: string
  leaderHandle: string
  sessionName: string
  windowIndex: string
  tmuxValue: string
  baseEnv: Record<string, string>
  // Why: null until the leader PTY is known; pre-spawn launch paths create the team before it exists.
  hostShell: AgentTeamHostShell | null
  panes: Map<string, TeamPane>
  paneOrder: string[]
  nextPaneNumber: number
  mainVertical: {
    mainPane: string
    lastColumnPane: string | null
  } | null
  previouslyFocusedPane: string | null
}
