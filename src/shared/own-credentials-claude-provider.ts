import { isClaudeApiProviderEnv, isClaudeApiTuiAgent } from './claude-api-provider'
import { isDeepSeekProviderEnv, isDeepSeekTuiAgent } from './deepseek-claude-provider'

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
