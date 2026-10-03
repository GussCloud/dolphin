// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'

type CaptureCall = { worktreeId: string; tabIds: readonly string[]; localOnly: boolean }

const mocks = vi.hoisted(() => {
  const pendingStartupByTabId: Record<string, unknown> = {}
  const settings: Record<string, unknown> = {}
  const captureCalls: CaptureCall[] = []
  return {
    storeState: {
      pendingStartupByTabId,
      runtimeStatusByEnvironmentId: new Map(),
      settings,
      repos: []
    },
    watcherCoverage: true,
    captureResult: true,
    captureCalls
  }
})

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector(mocks.storeState),
    { getState: () => mocks.storeState }
  )
}))

vi.mock('../terminal-pane/terminal-parked-tab-watchers', () => ({
  canWatcherCoverParkedTerminalTab: () => mocks.watcherCoverage
}))

vi.mock('../terminal-pane/parked-terminal-buffer-capture', () => ({
  captureParkedTerminalBuffers: (args: {
    worktreeId: string
    tabIds: readonly string[]
    localOnly: boolean
  }) => {
    mocks.captureCalls.push(args)
    return mocks.captureResult
  }
}))

vi.mock('../terminal/terminal-provider-snapshot-capability', () => ({
  terminalProviderHasAuthoritativeSnapshot: () => true
}))

import { CLOSED_FLOATING_PANEL_PARK_DELAY_MS } from './closed-floating-panel-parking'
import { useClosedFloatingPanelParking } from './use-closed-floating-panel-parking'

const tabs: TerminalTab[] = [
  {
    id: 'tab-1',
    ptyId: 'global-floating-terminal@@pty-1',
    worktreeId: 'global-floating-terminal',
    title: 'Terminal',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
]

describe('useClosedFloatingPanelParking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.watcherCoverage = true
    mocks.captureResult = true
    mocks.captureCalls = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parks the closed panel after the hot-retain window and unparks on reopen', () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useClosedFloatingPanelParking({ open, terminalTabs: tabs }),
      { initialProps: { open: true } }
    )
    expect(result.current).toBe(false)

    rerender({ open: false })
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(CLOSED_FLOATING_PANEL_PARK_DELAY_MS - 1)
    })
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)
    expect(mocks.captureCalls).toEqual([
      { worktreeId: 'global-floating-terminal', tabIds: ['tab-1'], repos: [], localOnly: true }
    ])

    rerender({ open: true })
    expect(result.current).toBe(false)
  })

  it('restarts the closed clock on every close', () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useClosedFloatingPanelParking({ open, terminalTabs: tabs }),
      { initialProps: { open: false } }
    )
    act(() => {
      vi.advanceTimersByTime(CLOSED_FLOATING_PANEL_PARK_DELAY_MS / 2)
    })
    rerender({ open: true })
    rerender({ open: false })
    act(() => {
      vi.advanceTimersByTime(CLOSED_FLOATING_PANEL_PARK_DELAY_MS / 2)
    })
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(CLOSED_FLOATING_PANEL_PARK_DELAY_MS / 2)
    })
    expect(result.current).toBe(true)
  })

  it('stays mounted when a tab cannot be watched or its buffers could not be captured', () => {
    mocks.watcherCoverage = false
    const { result } = renderHook(() =>
      useClosedFloatingPanelParking({ open: false, terminalTabs: tabs })
    )
    act(() => {
      vi.advanceTimersByTime(CLOSED_FLOATING_PANEL_PARK_DELAY_MS)
    })
    expect(result.current).toBe(false)
    expect(mocks.captureCalls).toEqual([])

    mocks.watcherCoverage = true
    mocks.captureResult = false
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current).toBe(false)
    expect(mocks.captureCalls).toHaveLength(1)

    mocks.captureResult = true
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current).toBe(true)
  })
})
