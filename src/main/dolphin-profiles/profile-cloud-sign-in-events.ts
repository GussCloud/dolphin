type DolphinCloudSignedInListener = () => void

const listeners = new Set<DolphinCloudSignedInListener>()

/** Fires after a sign-in (or cloud profile creation) stores a new cloud session. */
export function onDolphinCloudSignedIn(listener: DolphinCloudSignedInListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitDolphinCloudSignedIn(): void {
  // Why: callers link the local profile to the cloud identity right after saving the
  // session, so listeners run once that synchronous turn has finished.
  queueMicrotask(() => {
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        console.warn(
          '[dolphin-profiles] Cloud sign-in listener failed:',
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  })
}
