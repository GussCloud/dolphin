import { isClaudeApiProviderEnv, isClaudeApiTuiAgent } from './claude-api-provider'
import { isDeepSeekProviderEnv, isDeepSeekTuiAgent } from './deepseek-claude-provider'
import { isClaudeHookAgentType } from './deepseek-status-identity'
import type { TuiAgent } from './tui-agent'

// Why one predicate: DeepSeek and the API-key agent run the same `claude` binary on credentials
// Dolphin injects at spawn, so every managed-account path must skip both, never just one.

/** An agent that runs the Claude Code CLI on credentials of its own, never a managed account's. */
export function isOwnCredentialsClaudeTuiAgent(agent: unknown): boolean {
  return isDeepSeekTuiAgent(agent) || isClaudeApiTuiAgent(agent)
}

/** A pane env carrying the provider marker of such an agent (teammates, relaunches). */
export function isOwnCredentialsClaudeProviderEnv(
  env: Record<string, string | undefined> | undefined
): boolean {
  return isDeepSeekProviderEnv(env) || isClaudeApiProviderEnv(env)
}

/**
 * The agent to launch again for a pane: its Claude hook status names only the CLI (`claude`), so a
 * tab launched as DeepSeek or an API-key agent keeps that agent instead of becoming plain Claude.
 */
export function resolvePaneRelaunchAgent(
  statusAgent: TuiAgent | null,
  tabAgent: TuiAgent | null
): TuiAgent | null {
  // Trade-off: a plain `claude` typed later in that pane is relaunched as the tab's agent too.
  if (tabAgent && isOwnCredentialsClaudeTuiAgent(tabAgent) && isClaudeHookAgentType(statusAgent)) {
    return tabAgent
  }
  return statusAgent ?? tabAgent
}
