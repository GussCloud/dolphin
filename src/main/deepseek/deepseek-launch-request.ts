import { isDeepSeekProviderEnv, isDeepSeekTuiAgent } from '../../shared/deepseek-claude-provider'

/**
 * True for a DeepSeek agent launch, and for any pane carrying the provider marker
 * (Agent Teams teammates spawn with the team env, not with a launch agent).
 */
export function isDeepSeekLaunchRequest(args: {
  launchAgent: unknown
  env: Record<string, string | undefined> | undefined
}): boolean {
  return isDeepSeekTuiAgent(args.launchAgent) || isDeepSeekProviderEnv(args.env)
}
