import type { BrowserPage, BrowserWorkspace } from '../../../../../shared/browser-workspace-types'
import { hasActiveBrowserPageDownload } from '../navigate/browser-page-download-activity'
import { browserPageNeedsPaintRetention } from './browser-guest-paint-retention'
import { isBrowserPageDevToolsOpen } from './webview-registry'

// Why 4: every hidden worktree that retains browser guests keeps one Electron
// guest process per page alive purely for instant revisits, so guest memory
// grew linearly with worktrees visited (#12137). Four hidden worktrees covers
// the common switch-back working set; older ones are destroyed and rebuild
// from persisted tab state on the next visit.
export const BROWSER_GUEST_HIDDEN_WORKTREE_RETENTION_LIMIT = 4

/**
 * Hidden worktrees whose retained guests fall beyond the budget, LRU-first.
 *
 * orderedWorktreeIds must be most-recently-activated first (LRU order =
 * worktree activation order). Only worktrees that actually hold live guests
 * count toward the limit. The active worktree never counts and is never
 * evicted. isEvictable is consulted lazily, only for worktrees beyond the
 * limit — a non-evictable one (a guest an automation/mobile controller is
 * actively driving, or one still writing a download) stays retained over
 * budget.
 */
export function selectBrowserGuestEvictionWorktreeIds(args: {
  orderedWorktreeIds: readonly string[]
  activeWorktreeId: string | null
  isRetained: (worktreeId: string) => boolean
  holdsLiveGuests: (worktreeId: string) => boolean
  isEvictable: (worktreeId: string) => boolean
  limit?: number
}): string[] {
  const limit = args.limit ?? BROWSER_GUEST_HIDDEN_WORKTREE_RETENTION_LIMIT
  const evictedIds: string[] = []
  const seen = new Set<string>()
  let retained = 0
  for (const worktreeId of args.orderedWorktreeIds) {
    if (
      seen.has(worktreeId) ||
      worktreeId === args.activeWorktreeId ||
      !args.isRetained(worktreeId) ||
      !args.holdsLiveGuests(worktreeId)
    ) {
      seen.add(worktreeId)
      continue
    }
    seen.add(worktreeId)
    if (retained < limit) {
      retained += 1
      continue
    }
    if (args.isEvictable(worktreeId)) {
      evictedIds.push(worktreeId)
    }
  }
  return evictedIds
}

// Why the fallback: webviews key by page id, but legacy sessions persisted
// before pages existed key by the workspace tab id (see collectBrowserWebviewIds).
export function worktreeHoldsLiveBrowserGuests(
  browserTabs: readonly BrowserWorkspace[],
  browserPagesByWorkspace: Record<string, BrowserPage[]>,
  hasLiveGuest: (browserPageId: string) => boolean
): boolean {
  return browserTabs.some((tab) => {
    const pages = browserPagesByWorkspace[tab.id] ?? []
    if (pages.length === 0) {
      return hasLiveGuest(tab.id)
    }
    return pages.some((page) => hasLiveGuest(page.id))
  })
}

// Why eviction needs more than the paint terms: eviction DESTROYS the guest rather than parking
// it, main cancels a page's active downloads when its guest unregisters (tab-close semantics), and
// the guest's detached DevTools window closes with it.
export function browserPageVetoesGuestDiscard(browserPageId: string): boolean {
  return (
    browserPageNeedsPaintRetention(browserPageId) ||
    hasActiveBrowserPageDownload(browserPageId) ||
    isBrowserPageDevToolsOpen(browserPageId)
  )
}

export function browserTabsVetoGuestEviction(tabs: readonly BrowserWorkspace[]): boolean {
  return tabs.some((tab) => browserTabVisibilityPageIds(tab).some(browserPageVetoesGuestDiscard))
}

/**
 * Live guests a hidden worktree can discard while keeping only the page the user would see on
 * return: the active browser tab's active page. Discarded pages stay in the store and rebuild from
 * their saved URL when next shown (the same path as whole-worktree eviction). Document previews
 * mount through their own attach path, so they are never discarded here.
 */
export function selectHiddenWorktreeDiscardableBrowserGuestIds(args: {
  browserTabs: readonly BrowserWorkspace[]
  browserPagesByWorkspace: Record<string, BrowserPage[]>
  activeBrowserTabId: string | null
  hasLiveGuest: (browserPageId: string) => boolean
  vetoesDiscard: (browserPageId: string) => boolean
}): string[] {
  const { browserTabs, browserPagesByWorkspace } = args
  const activeTab =
    browserTabs.find((tab) => tab.id === args.activeBrowserTabId) ?? browserTabs[0] ?? null
  const keptGuestId = activeTab
    ? (activeTab.activePageId ?? browserPagesByWorkspace[activeTab.id]?.[0]?.id ?? activeTab.id)
    : null
  const discardable: string[] = []
  for (const tab of browserTabs) {
    const pages = browserPagesByWorkspace[tab.id] ?? []
    // Legacy sessions key their single guest by the workspace tab id.
    const candidates = pages.length === 0 ? [{ id: tab.id, docLocation: null }] : pages
    for (const page of candidates) {
      if (
        page.id !== keptGuestId &&
        !page.docLocation &&
        args.hasLiveGuest(page.id) &&
        !args.vetoesDiscard(page.id)
      ) {
        discardable.push(page.id)
      }
    }
  }
  return discardable
}

// Mirrors BrowserOverlaySlot's page-id derivation so visibility pinning
// (automation-visible / mobile-driven) protects exactly the slots it paints.
export function browserTabVisibilityPageIds(tab: BrowserWorkspace): readonly string[] {
  return tab.pageIds && tab.pageIds.length > 0 ? tab.pageIds : [tab.activePageId ?? tab.id]
}

/**
 * The hidden-worktree page cap across all retained worktrees. The active worktree keeps every
 * page; worktrees already evicted whole are skipped; a worktree whose agent is still running keeps
 * every page, since the agent may be driving any of them over CDP.
 */
export function selectHiddenWorktreeBrowserGuestDiscards(args: {
  worktreeIds: readonly string[]
  activeWorktreeId: string | null
  isRetained: (worktreeId: string) => boolean
  isAgentActive: (worktreeId: string) => boolean
  browserTabsByWorktree: Record<string, readonly BrowserWorkspace[]>
  browserPagesByWorkspace: Record<string, BrowserPage[]>
  activeBrowserTabIdByWorktree: Record<string, string | null | undefined>
  hasLiveGuest: (browserPageId: string) => boolean
  vetoesDiscard: (browserPageId: string) => boolean
}): string[] {
  const discards: string[] = []
  for (const worktreeId of new Set(args.worktreeIds)) {
    if (
      worktreeId === args.activeWorktreeId ||
      !args.isRetained(worktreeId) ||
      args.isAgentActive(worktreeId)
    ) {
      continue
    }
    discards.push(
      ...selectHiddenWorktreeDiscardableBrowserGuestIds({
        browserTabs: args.browserTabsByWorktree[worktreeId] ?? [],
        browserPagesByWorkspace: args.browserPagesByWorkspace,
        activeBrowserTabId: args.activeBrowserTabIdByWorktree[worktreeId] ?? null,
        hasLiveGuest: args.hasLiveGuest,
        vetoesDiscard: args.vetoesDiscard
      })
    )
  }
  return discards
}

// LRU order = worktree activation order; activating moves the id to the front.
export function touchBrowserGuestWorktreeRecency(recency: string[], worktreeId: string): void {
  const index = recency.indexOf(worktreeId)
  if (index !== -1) {
    recency.splice(index, 1)
  }
  recency.unshift(worktreeId)
}
