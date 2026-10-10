export type BrowserGuestVisibility = {
  isVisible: () => boolean
  onBecameVisible: (listener: () => void) => () => void
}

export const ALWAYS_VISIBLE_BROWSER_GUEST: BrowserGuestVisibility = {
  isVisible: () => true,
  onBecameVisible: () => () => {}
}

// Why: each applied title rewrites the page store, the tab strip, the session file and the mobile graph.
export const BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS = 1000
// Why bounded rather than deferred forever: mobile and paired clients still list hidden worktrees' tabs.
export const BROWSER_GUEST_HIDDEN_CHURN_INTERVAL_MS = 30_000

export type BrowserGuestChurnThrottle = {
  /** Records that the guest changed; `run` reads the latest value when it fires. */
  mark: () => void
  /** Runs now if a change is pending. */
  flush: () => void
  /** Drops a pending change without running it. */
  cancel: () => void
}

/**
 * Leading-edge throttle for guest metadata events (title, favicon). A visible guest applies at most
 * once per second; a hidden one at most once per 30s, and immediately when it becomes visible.
 */
export function createBrowserGuestChurnThrottle({
  run,
  visibility,
  now = Date.now
}: {
  run: () => void
  visibility: BrowserGuestVisibility
  now?: () => number
}): BrowserGuestChurnThrottle {
  let lastRunAt = Number.NEGATIVE_INFINITY
  let pending = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let unsubscribeVisible: (() => void) | null = null

  const clearSchedule = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    unsubscribeVisible?.()
    unsubscribeVisible = null
  }

  const flush = (): void => {
    clearSchedule()
    if (!pending) {
      return
    }
    pending = false
    lastRunAt = now()
    run()
  }

  const mark = (): void => {
    pending = true
    if (timer !== null) {
      return
    }
    const visible = visibility.isVisible()
    const interval = visible
      ? BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS
      : BROWSER_GUEST_HIDDEN_CHURN_INTERVAL_MS
    const wait = lastRunAt + interval - now()
    if (wait <= 0) {
      flush()
      return
    }
    timer = setTimeout(flush, wait)
    if (!visible) {
      unsubscribeVisible = visibility.onBecameVisible(flush)
    }
  }

  const cancel = (): void => {
    clearSchedule()
    pending = false
  }

  return { mark, flush, cancel }
}
