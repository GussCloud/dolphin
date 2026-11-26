/**
 * True when the team's tmux shim would create teammate panes on another Dolphin runtime. A DeepSeek
 * or API-key team must not: that host may not know the marker and would start plain `claude` on
 * the user's Anthropic account, so those leaders keep teammates in-process instead.
 */
export function routesAgentTeamToRemoteRuntime(env: Record<string, string | undefined>): boolean {
  return Boolean(env.DOLPHIN_PAIRING_CODE || env.DOLPHIN_ENVIRONMENT)
}
