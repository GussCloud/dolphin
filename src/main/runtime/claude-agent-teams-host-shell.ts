import { WINDOWS_GIT_BASH_SHELL } from '../../shared/windows-terminal-shell'
import { isWslUncPath } from '../../shared/wsl-paths'
import { splitWorktreeIdForFilesystem } from '../../shared/worktree/id'

/** Which shell teammate panes run in; fixed per team from its leader's execution host. */
export type AgentTeamHostShell = 'native-windows-git-bash' | 'default'

export type AgentTeamLeaderExecution = {
  connectionId: string | null
  isWsl: boolean | null
  wslDistro: string | null
  worktreeId: string
}

/**
 * Returns null only on win32 when the leader PTY is unknown: guessing there
 * would launch Claude's POSIX teammate command in cmd/PowerShell.
 */
export function resolveAgentTeamHostShell(
  leader: AgentTeamLeaderExecution | null,
  platform: NodeJS.Platform = process.platform
): AgentTeamHostShell | null {
  if (platform !== 'win32') {
    return 'default'
  }
  if (!leader) {
    return null
  }
  return leader.connectionId || isWslAgentTeamLeader(leader, platform)
    ? 'default'
    : 'native-windows-git-bash'
}

/** Pre-spawn guess from the workspace alone; a WSL/SSH leader's teammates run in POSIX panes, so Git Bash must not gate them. */
export function resolveWorkspaceAgentTeamHostShell(workspace: {
  connectionId?: string | null
  path: string
  id: string
}): AgentTeamHostShell | null {
  return resolveAgentTeamHostShell({
    connectionId: workspace.connectionId ?? null,
    isWsl: isWslUncPath(workspace.path) || null,
    wslDistro: null,
    worktreeId: workspace.id
  })
}

/** A Windows leader running in WSL (by PTY or by a `\\wsl$` worktree); SSH leaders are not. */
export function isWslAgentTeamLeader(
  leader: AgentTeamLeaderExecution | null,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (platform !== 'win32' || !leader || leader.connectionId) {
    return false
  }
  if (leader.isWsl || leader.wslDistro) {
    return true
  }
  const worktreePath = splitWorktreeIdForFilesystem(leader.worktreeId)?.worktreePath
  return Boolean(worktreePath && isWslUncPath(worktreePath))
}

/**
 * Native panes need an absolute shim CLI and, for a Windows leader that is or may be
 * native, Git Bash to run Claude's POSIX teammate command; otherwise teammates run in-process.
 */
export function canLaunchAgentTeamPanes(args: {
  hostShell: AgentTeamHostShell | null
  leaderIsWsl: boolean
  shimBin: string | null
  resolveGitBash: () => string | null
}): boolean {
  // Why: the WSL guest tmux shim calls the guest launcher directly, never the Windows shim bin.
  if (args.leaderIsWsl) {
    return true
  }
  if (!args.shimBin) {
    return false
  }
  return args.hostShell === 'default' || Boolean(args.resolveGitBash())
}

// Why: without TMUX, Claude's `--teammate-mode auto` picks in-process teammates.
export const IN_PROCESS_AGENT_TEAMS_ENV: Readonly<Record<string, string>> = {
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1'
}
export const IN_PROCESS_AGENT_TEAMS_ENV_TO_DELETE: readonly string[] = ['TMUX', 'TMUX_PANE']

export function teammatePaneShellOverride(hostShell: AgentTeamHostShell): string | undefined {
  return hostShell === 'native-windows-git-bash' ? WINDOWS_GIT_BASH_SHELL : undefined
}
