import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BROWSER_GUEST_HIDDEN_CHURN_INTERVAL_MS,
  BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS,
  createBrowserGuestChurnThrottle,
  type BrowserGuestVisibility
} from './browser-guest-churn-throttle'

function createVisibility(initiallyVisible: boolean) {
  let visible = initiallyVisible
  const listeners = new Set<() => void>()
  const visibility: BrowserGuestVisibility = {
    isVisible: () => visible,
    onBecameVisible: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  const show = (): void => {
    visible = true
    for (const listener of listeners) {
      listener()
    }
  }
  return { visibility, show, listeners }
}

describe('createBrowserGuestChurnThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies the first change at once and coalesces a burst into one trailing run', () => {
    const run = vi.fn()
    const throttle = createBrowserGuestChurnThrottle({
      run,
      visibility: createVisibility(true).visibility
    })

    throttle.mark()
    expect(run).toHaveBeenCalledTimes(1)
    for (let tick = 0; tick < 10; tick++) {
      throttle.mark()
    }
    expect(run).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('caps a once-per-second title ticker at one store write per second while visible', () => {
    const run = vi.fn()
    const throttle = createBrowserGuestChurnThrottle({
      run,
      visibility: createVisibility(true).visibility
    })
    for (let second = 0; second < 60; second++) {
      throttle.mark()
      throttle.mark()
      vi.advanceTimersByTime(1000)
    }
    expect(run.mock.calls.length).toBeLessThanOrEqual(61)
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(59)
  })

  it('holds a hidden guest to one write per hidden interval', () => {
    const run = vi.fn()
    const throttle = createBrowserGuestChurnThrottle({
      run,
      visibility: createVisibility(false).visibility
    })
    for (let second = 0; second < 60; second++) {
      throttle.mark()
      vi.advanceTimersByTime(1000)
    }
    // Leading write plus one per elapsed hidden interval.
    expect(run.mock.calls.length).toBe(1 + 60_000 / BROWSER_GUEST_HIDDEN_CHURN_INTERVAL_MS)
  })

  it('flushes the deferred value as soon as the guest becomes visible', () => {
    const run = vi.fn()
    const { visibility, show, listeners } = createVisibility(false)
    const throttle = createBrowserGuestChurnThrottle({ run, visibility })
    throttle.mark()
    throttle.mark()
    expect(run).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(1)

    show()
    expect(run).toHaveBeenCalledTimes(2)
    expect(listeners.size).toBe(0)
    vi.advanceTimersByTime(BROWSER_GUEST_HIDDEN_CHURN_INTERVAL_MS)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('cancel drops a pending change; flush with nothing pending does nothing', () => {
    const run = vi.fn()
    const throttle = createBrowserGuestChurnThrottle({
      run,
      visibility: createVisibility(true).visibility
    })
    throttle.mark()
    throttle.mark()
    throttle.cancel()
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS)
    throttle.flush()
    expect(run).toHaveBeenCalledTimes(1)
  })
})
