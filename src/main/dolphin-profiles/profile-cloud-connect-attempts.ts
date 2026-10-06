// Orders overlapping sign-ins and sign-outs on the active profile: the newest
// connect links, and a sign-out cancels every connect that started before it.

let nextCloudConnectAttempt = 0
let linkedCloudConnectAttempt = 0
let pendingBrowserSignIns = 0

export function beginCloudConnectAttempt(): number {
  nextCloudConnectAttempt += 1
  return nextCloudConnectAttempt
}

export function isCloudConnectAttemptSuperseded(attempt: number): boolean {
  return attempt < linkedCloudConnectAttempt
}

export function markCloudConnectAttemptLinked(attempt: number): void {
  linkedCloudConnectAttempt = attempt
}

/** Returns the sign-out epoch; a connect linked after it has a higher attempt. */
export function invalidateOutstandingCloudConnectAttempts(): number {
  nextCloudConnectAttempt += 1
  linkedCloudConnectAttempt = nextCloudConnectAttempt
  return linkedCloudConnectAttempt
}

export function hasCloudConnectLinkedSince(epoch: number): boolean {
  return linkedCloudConnectAttempt > epoch
}

/** Brackets a browser sign-in the user started, so background sign-ins yield to it. */
export function beginBrowserCloudSignIn(): () => void {
  pendingBrowserSignIns += 1
  return () => {
    pendingBrowserSignIns -= 1
  }
}

export function isBrowserCloudSignInPending(): boolean {
  return pendingBrowserSignIns > 0
}

/** @internal - exposed for tests only */
export function _resetCloudConnectAttemptsForTests(): void {
  nextCloudConnectAttempt = 0
  linkedCloudConnectAttempt = 0
  pendingBrowserSignIns = 0
}
