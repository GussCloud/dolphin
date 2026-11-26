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
  launchAgent?: unknown
  command?: string
  launch?: WorktreeLaunchLocation
}): AgentTeamLaunchProvider {
  const deepSeekProvider = isDeepSeekTuiAgent(args.launchAgent)
  const claudeApiLeader =
    isClaudeApiTuiAgent(args.launchAgent) || isClaudeApiProviderEnv(args.baseEnv)
  const claudeApiAccountId = claudeApiLeader
    ? resolveClaudeApiTeamAccountId({
        launchEnv: args.baseEnv,
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
