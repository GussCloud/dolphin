type DolphinCloudSessionInvalidationListener = () => void

const listeners = new Set<DolphinCloudSessionInvalidationListener>()

/**
 * Fires when an auth failure (revoked or rotated-away refresh token) clears a
 * stored cloud session. Never fires for an explicit user sign-out, which already
 * hands the fresh auth status back to its caller.
 */
export function onDolphinCloudSessionInvalidated(
  listener: DolphinCloudSessionInvalidationListener
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitDolphinCloudSessionInvalidated(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch (error) {
      console.warn(
        '[dolphin-profiles] Cloud session invalidation listener failed:',
        error instanceof Error ? error.message : String(error)
      )
    }
  }
}
