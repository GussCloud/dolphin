export const DOLPHIN_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY =
  '__dolphinFeatureInteractionSource'

export const DOLPHIN_RUNTIME_RPC_BROWSER_UI_SOURCE = 'browser-pane-ui'

export function withBrowserPaneUiRuntimeRpcSource(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      [DOLPHIN_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY]: DOLPHIN_RUNTIME_RPC_BROWSER_UI_SOURCE
    }
  }
  return {
    ...value,
    [DOLPHIN_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY]: DOLPHIN_RUNTIME_RPC_BROWSER_UI_SOURCE
  }
}

export function isBrowserPaneUiRuntimeRpcParams(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)[DOLPHIN_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY] ===
      DOLPHIN_RUNTIME_RPC_BROWSER_UI_SOURCE
  )
}
