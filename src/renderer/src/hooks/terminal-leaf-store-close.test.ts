// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLOSE_TERMINAL_PANE_EVENT } from '@/constants/terminal'
import {
  closeTerminalLeafInStore,
  dispatchLeafCloseWithStoreFallback,
  type TerminalLeafStoreCloseStore
} from './terminal-leaf-store-close'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))

const TAB_ID = 'tab-leader'
const LEADER_LEAF = '11111111-1111-4111-8111-111111111111'
const TEAMMATE_LEAF = '22222222-2222-4222-8222-222222222222'

function makeStore() {
  return {
    tabsByWorktree: { worktree: [{ id: TAB_ID }] },
    terminalLayoutsByTabId: {
      [TAB_ID]: {
        root: {
          type: 'split' as const,
          direction: 'vertical' as const,
          ratio: 0.5,
          first: { type: 'leaf' as const, leafId: LEADER_LEAF },
          second: { type: 'leaf' as const, leafId: TEAMMATE_LEAF }
        },
        activeLeafId: LEADER_LEAF,
        expandedLeafId: null,
        ptyIdsByLeafId: { [LEADER_LEAF]: 'pty-leader', [TEAMMATE_LEAF]: 'pty-teammate' }
      }
    },
    setTabLayout: vi.fn(),
    clearTabPtyId: vi.fn(),
    closeTab: vi.fn(),
    retireAgentPaneAuthority: vi.fn()
  } satisfies TerminalLeafStoreCloseStore
}

describe('closeTerminalLeafInStore', () => {
  it('removes the leaf and retires its agent session so the next mount cannot resume it', () => {
    const store = makeStore()

    expect(
      closeTerminalLeafInStore(store, TAB_ID, TEAMMATE_LEAF, {
        preserveSleepingAgentSession: false
      })
    ).toBe('removed')
    expect(store.setTabLayout).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({
        root: { type: 'leaf', leafId: LEADER_LEAF },
        ptyIdsByLeafId: { [LEADER_LEAF]: 'pty-leader' }
      })
    )
    expect(store.clearTabPtyId).toHaveBeenCalledWith(TAB_ID, 'pty-teammate')
    expect(store.retireAgentPaneAuthority).toHaveBeenCalledWith(`${TAB_ID}:${TEAMMATE_LEAF}`, {
      preserveSleepingAgentSession: false
    })
    expect(store.closeTab).not.toHaveBeenCalled()
  })

  it('closes the tab of a rootless single-pane layout bound to the leaf', () => {
    const store = {
      ...makeStore(),
      terminalLayoutsByTabId: {
        [TAB_ID]: {
          root: null,
          activeLeafId: TEAMMATE_LEAF,
          expandedLeafId: null,
          ptyIdsByLeafId: { [TEAMMATE_LEAF]: 'pty-teammate' }
        }
      }
    }

    expect(
      closeTerminalLeafInStore(store, TAB_ID, TEAMMATE_LEAF, {
        preserveSleepingAgentSession: true
      })
    ).toBe('removed')
    expect(store.closeTab).toHaveBeenCalledWith(TAB_ID, {
      reason: 'pty-exit',
      captureRecentlyClosed: false
    })
  })

  it('ignores a leaf that is no longer in the layout', () => {
    const store = makeStore()

    expect(
      closeTerminalLeafInStore(store, TAB_ID, 'gone', {
        preserveSleepingAgentSession: false
      })
    ).toBe('already-removed')
    expect(store.setTabLayout).not.toHaveBeenCalled()
    expect(store.closeTab).not.toHaveBeenCalled()
  })
})

describe('dispatchLeafCloseWithStoreFallback', () => {
  const listeners: EventListener[] = []
  afterEach(() => {
    for (const listener of listeners.splice(0)) {
      window.removeEventListener(CLOSE_TERMINAL_PANE_EVENT, listener)
    }
  })

  it('closes the stored leaf when no mounted tab claims the close', () => {
    const store = makeStore()

    dispatchLeafCloseWithStoreFallback(TAB_ID, TEAMMATE_LEAF, () => store)

    expect(store.setTabLayout).toHaveBeenCalledTimes(1)
    expect(store.retireAgentPaneAuthority).toHaveBeenCalledTimes(1)
  })

  it('leaves the store to the mounted tab that claims the close', () => {
    const store = makeStore()
    const listener: EventListener = (event) => {
      if (event instanceof CustomEvent) {
        event.detail.onClaimedByMountedTab?.()
      }
    }
    listeners.push(listener)
    window.addEventListener(CLOSE_TERMINAL_PANE_EVENT, listener)

    dispatchLeafCloseWithStoreFallback(TAB_ID, TEAMMATE_LEAF, () => store)

    expect(store.setTabLayout).not.toHaveBeenCalled()
    expect(store.retireAgentPaneAuthority).not.toHaveBeenCalled()
  })
})
