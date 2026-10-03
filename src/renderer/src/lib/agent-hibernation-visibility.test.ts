// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  startAgentHibernationCoordinator,
  stopAgentHibernationCoordinator
} from './agent-hibernation-coordinator'
import {
  installEligibleState,
  LEAF,
  NOW,
  resetAgentHibernationCoordinatorFixture
} from './agent-hibernation-coordinator-test-fixture'
import { resetStaleDocumentVisibilityForTesting } from '@/components/terminal-pane/stale-document-visibility'

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('agent hibernation coordinator while the window is hidden', () => {
  beforeEach(() => {
    setVisibility('visible')
    resetStaleDocumentVisibilityForTesting()
  })
  afterEach(() => {
    resetAgentHibernationCoordinatorFixture()
    resetStaleDocumentVisibilityForTesting()
    setVisibility('visible')
    vi.restoreAllMocks()
  })

  it('keeps ticking and hibernates idle agents while hidden', async () => {
    vi.useFakeTimers()
    const shutdown = installEligibleState(vi.fn().mockResolvedValue(undefined))
    setVisibility('hidden')
    startAgentHibernationCoordinator({ intervalMs: 1000, now: () => NOW })

    await vi.advanceTimersByTimeAsync(1000)
    expect(shutdown).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)

    expect(shutdown).toHaveBeenCalledWith('wt-bg', {
      paneKey: `tab-1:${LEAF}`,
      tabId: 'tab-1',
      leafId: LEAF,
      ptyId: 'pty-1'
    })
  })

  // Why: an extra tick on visibility change would confirm a candidate seconds after it first
  // appeared instead of one full interval later.
  it('does not tick on visibility changes', async () => {
    vi.useFakeTimers()
    const add = vi.spyOn(document, 'addEventListener')
    const shutdown = installEligibleState(vi.fn().mockResolvedValue(undefined))
    startAgentHibernationCoordinator({ intervalMs: 60_000, now: () => NOW })

    setVisibility('hidden')
    setVisibility('visible')
    setVisibility('hidden')
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)

    expect(add.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(false)
    expect(shutdown).not.toHaveBeenCalled()
    stopAgentHibernationCoordinator()
  })
})
