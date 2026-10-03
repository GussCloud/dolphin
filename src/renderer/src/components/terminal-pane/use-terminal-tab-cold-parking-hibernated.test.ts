// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'

const WORKTREE_ID = 'wt-1'
const LEAF_H = '11111111-1111-4111-8111-111111111111'

const mocks = vi.hoisted(() => {
  const storeState: Record<string, unknown> = {}
  const syncedParkedTabIds: ReadonlySet<string>[] = []
  return { storeState, syncedParkedTabIds }
})

vi.mock('../../store', () => ({
  useAppStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector(mocks.storeState),
    { getState: () => mocks.storeState, subscribe: () => () => {} }
  )
}))

vi.mock('../terminal/terminal-provider-snapshot-capability', () => ({
  terminalProviderHasAuthoritativeSnapshot: () => true
}))

vi.mock('./terminal-parked-tab-watchers', () => ({
  canWatcherCoverParkedTerminalTab: (_worktreeId: string, tab: { ptyId: string | null }) =>
    tab.ptyId !== null,
  disposeParkedTerminalWatchersForWorktree: vi.fn(),
  syncParkedTerminalTabWatchers: (args: { parkedTabIds: ReadonlySet<string> }) => {
    mocks.syncedParkedTabIds.push(new Set(args.parkedTabIds))
  }
}))

vi.mock('@/lib/crash-breadcrumb-recorder', () => ({
  recordRendererCrashBreadcrumb: vi.fn()
}))

import {
  requestHibernatedWakeMount,
  resetHibernatedWakeMountRequestsForTest
} from '@/lib/hibernated-wake-mount-requests'
import { TERMINAL_TAB_COLD_PARK_DELAY_MS } from './terminal-hidden-view-parking'
import { TERMINAL_TAB_PARK_FLIP_BURST_WINDOW_MS } from './terminal-park-verdict-flip-telemetry'
import { useTerminalTabColdParking } from './use-terminal-tab-cold-parking'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only id/ptyId/pendingActivationSpawn.
const liveTab = { id: 'tab-live', ptyId: `${WORKTREE_ID}@@session-live` } as TerminalTab
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: as above.
const hibernatedTab = { id: 'tab-h', ptyId: null } as TerminalTab
const hibernationRecord = {
  paneKey: `tab-h:${LEAF_H}`,
  tabId: 'tab-h',
  worktreeId: WORKTREE_ID,
  state: 'done',
  origin: 'worktree-sleep'
}

const NO_ACTIVE_TAB: string | null = null

function hookArgs(shouldMeasureHiddenWorktree = false) {
  return {
    worktreeId: WORKTREE_ID,
    terminalTabs: [liveTab, hibernatedTab],
    assignments: new Map<string, { groupId: string; isActiveInGroup: boolean }>(),
    isWorktreeActive: false,
    activeTerminalTabId: NO_ACTIVE_TAB,
    coldParkTerminalPanes: false,
    shouldMeasureHiddenWorktree,
    activityTerminalPortals: [],
    activationDeferredMountTabIds: null
  }
}

describe('useTerminalTabColdParking — hibernated tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    mocks.syncedParkedTabIds = []
    mocks.storeState = {
      pendingStartupByTabId: {},
      runtimeStatusByEnvironmentId: new Map(),
      runtimePaneTitlesByTabId: {},
      settings: {},
      repos: [],
      tabsByWorktree: { [WORKTREE_ID]: [liveTab, hibernatedTab] },
      ptyIdsByTabId: { 'tab-live': [liveTab.ptyId], 'tab-h': [] },
      terminalLayoutsByTabId: {
        'tab-h': {
          root: { type: 'leaf', leafId: LEAF_H },
          activeLeafId: LEAF_H,
          expandedLeafId: null,
          ptyIdsByLeafId: { [LEAF_H]: `${WORKTREE_ID}@@session-h` }
        }
      },
      sleepingAgentSessionsByPaneKey: { [hibernationRecord.paneKey]: hibernationRecord }
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    resetHibernatedWakeMountRequestsForTest()
  })

  it('parks a hidden hibernated tab at the cold delay, past the hot-retain, without a watcher', () => {
    const { result } = renderHook(() => useTerminalTabColdParking(hookArgs()))
    expect(result.current.size).toBe(0)

    act(() => {
      vi.advanceTimersByTime(TERMINAL_TAB_COLD_PARK_DELAY_MS)
    })

    // The live tab is still inside its hot-retain window; the hibernated one is not retained.
    expect(result.current).toEqual(new Set(['tab-h']))
    expect(mocks.syncedParkedTabIds.at(-1)).toEqual(new Set())
  })

  it('keeps a parked hibernated tab unmounted through a hidden measure window', () => {
    const { result, rerender } = renderHook((args) => useTerminalTabColdParking(args), {
      initialProps: hookArgs()
    })
    act(() => {
      vi.advanceTimersByTime(TERMINAL_TAB_COLD_PARK_DELAY_MS)
    })
    expect(result.current).toEqual(new Set(['tab-h']))

    act(() => {
      rerender(hookArgs(true))
    })
    expect(result.current).toEqual(new Set(['tab-h']))
    act(() => {
      vi.advanceTimersByTime(TERMINAL_TAB_PARK_FLIP_BURST_WINDOW_MS)
      rerender(hookArgs(false))
    })
    expect(result.current).toEqual(new Set(['tab-h']))
  })

  it('unparks a hibernated tab a background wake asked to mount', () => {
    const { result } = renderHook(() => useTerminalTabColdParking(hookArgs()))
    act(() => {
      vi.advanceTimersByTime(TERMINAL_TAB_COLD_PARK_DELAY_MS)
    })
    expect(result.current).toEqual(new Set(['tab-h']))

    act(() => {
      vi.advanceTimersByTime(TERMINAL_TAB_PARK_FLIP_BURST_WINDOW_MS)
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registry keys on paneKey and identity only.
      requestHibernatedWakeMount('tab-h', hibernationRecord as never)
    })
    expect(result.current.has('tab-h')).toBe(false)
  })
})
