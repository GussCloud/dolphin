import {
  isOwnCredentialsClaudeProviderEnv,
  isOwnCredentialsClaudeTuiAgent
} from '../../shared/own-credentials-claude-provider'

/** A launch of `claude` on credentials Dolphin injects (DeepSeek, an API account), never a managed account's. */
export function isOwnCredentialsClaudeLaunchRequest(args: {
  launchAgent: unknown
  env: Record<string, string | undefined> | undefined
}): boolean {
  return (
    isOwnCredentialsClaudeTuiAgent(args.launchAgent) || isOwnCredentialsClaudeProviderEnv(args.env)
  )
}
