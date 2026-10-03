import { CLOSE_TERMINAL_PANE_EVENT, type CloseTerminalPaneDetail } from '@/constants/terminal'
import { detachTerminalLayoutLeaf } from '@/components/terminal-pane/terminal-layout-leaf-detach'
import {
  collectLeafIdsInOrder,
  normalizeTerminalLayoutSnapshot
} from '@/components/terminal-pane/terminal-layout-leaf-ids'
import { useAppStore, type AppState } from '@/store'
import { makePaneKey } from '../../../shared/stable-pane-id'

export type TerminalLeafStoreCloseStore = Pick<
  AppState,
  | 'terminalLayoutsByTabId'
  | 'setTabLayout'
  | 'clearTabPtyId'
  | 'closeTab'
  | 'retireAgentPaneAuthority'
> & { tabsByWorktree: Record<string, readonly { id: string }[]> }

/**
 * Closes a leaf in the tab's stored layout, for a tab with no mounted pane manager.
 * Why: a leaf left in an unmounted layout respawns on the next mount and cold-restores
 * its agent with `--resume`, reviving a pane the host already killed.
 */
export function closeTerminalLeafInStore(
  store: TerminalLeafStoreCloseStore,
  tabId: string,
  leafId: string,
  options: { preserveSleepingAgentSession: boolean }
): 'removed' | 'already-removed' {
  const tabExists = Object.values(store.tabsByWorktree).some((tabs) =>
    tabs.some((tab) => tab.id === tabId)
  )
  const layout = store.terminalLayoutsByTabId[tabId]
  const root = normalizeTerminalLayoutSnapshot(layout).snapshot.root
  // Why: a rootless single-pane layout names its leaf only through the PTY binding.
  const leafPresent =
    collectLeafIdsInOrder(root).includes(leafId) || Boolean(layout?.ptyIdsByLeafId?.[leafId])
  if (!tabExists || !leafPresent) {
    return 'already-removed'
  }
  const detached = detachTerminalLayoutLeaf(layout, leafId)
  if (!detached) {
    store.closeTab(tabId, { reason: 'pty-exit', captureRecentlyClosed: false })
    return 'removed'
  }
  store.retireAgentPaneAuthority(makePaneKey(tabId, leafId), options)
  store.setTabLayout(tabId, detached.sourceLayout)
  if (detached.ptyId) {
    store.clearTabPtyId(tabId, detached.ptyId)
  }
  return 'removed'
}

/** Routes a host leaf close to the mounted tab, else closes the leaf in the stored layout. */
export function dispatchLeafCloseWithStoreFallback(
  tabId: string,
  leafId: string,
  getStore: () => TerminalLeafStoreCloseStore = () => useAppStore.getState()
): void {
  let claimed = false
  const detail: CloseTerminalPaneDetail = {
    tabId,
    leafId,
    onClaimedByMountedTab: () => {
      claimed = true
    }
  }
  window.dispatchEvent(new CustomEvent(CLOSE_TERMINAL_PANE_EVENT, { detail }))
  if (!claimed) {
    // Why: the host already killed this leaf's PTY, so its agent session must not wake again.
    closeTerminalLeafInStore(getStore(), tabId, leafId, { preserveSleepingAgentSession: false })
  }
}
