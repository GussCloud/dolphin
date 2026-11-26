import { isClaudeApiProviderEnv, isClaudeApiTuiAgent } from '../../shared/claude-api-provider'
import { isDeepSeekTuiAgent } from '../../shared/deepseek-claude-provider'
import { resolveClaudeApiTeamAccountId } from '../claude-api/claude-api-launch'
import type { WorktreeLaunchLocation } from '../worktree-launch-owner'
import { routesAgentTeamToRemoteRuntime } from './claude-agent-teams-remote-routing'

/** How a runtime-created leader's team runs, for agents that bring their own credentials. */
export type AgentTeamLaunchProvider = {
  /** Teammates stay in the leader's process and env; no team is registered. */
  inProcess: boolean
  launch: { deepSeekProvider: boolean; claudeApiAccountId?: string }
}

export function resolveAgentTeamLaunchProvider(args: {
  baseEnv: Record<string, string | undefined>
  /** The pane's own env, without main's: what decides whether the leader is an API-key leader. */
  paneEnv?: Record<string, string | undefined>
  launchAgent?: unknown
  command?: string
  launch?: WorktreeLaunchLocation
}): AgentTeamLaunchProvider {
  // Why the pane env: a marker in main's own env (Dolphin started from an API pane) must not turn a
  // plain Claude leader into an API-key team.
  const paneEnv = args.paneEnv ?? args.baseEnv
  const deepSeekProvider = isDeepSeekTuiAgent(args.launchAgent)
  const claudeApiLeader = isClaudeApiTuiAgent(args.launchAgent) || isClaudeApiProviderEnv(paneEnv)
  const claudeApiAccountId = claudeApiLeader
    ? resolveClaudeApiTeamAccountId({
        launchEnv: paneEnv,
        command: args.command,
        launch: args.launch ?? {}
      })
    : null
  // Why in-process: a remote-routed team, or an API-key leader whose account is unknown here,
  // would spawn teammates that cannot be tied to the leader's credentials.
  const inProcess =
    ((deepSeekProvider || claudeApiLeader) && routesAgentTeamToRemoteRuntime(args.baseEnv)) ||
    (claudeApiLeader && !claudeApiAccountId)
  return {
    inProcess,
    launch: { deepSeekProvider, ...(claudeApiAccountId ? { claudeApiAccountId } : {}) }
  }
}
