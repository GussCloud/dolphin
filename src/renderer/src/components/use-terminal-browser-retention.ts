import { useEffect } from 'react'
import { useAppStore } from '../store'
import { onBrowserGuestPaintRetentionChange } from './browser-pane/host-guest/browser-guest-paint-retention'
import {
  browserPageVetoesGuestDiscard,
  browserTabsVetoGuestEviction,
  selectBrowserGuestEvictionWorktreeIds,
  selectHiddenWorktreeBrowserGuestDiscards,
  touchBrowserGuestWorktreeRecency,
  worktreeHoldsLiveBrowserGuests
} from './browser-pane/host-guest/browser-guest-worktree-retention'
import { installBrowserPageDownloadActivityTracking } from './browser-pane/navigate/browser-page-download-activity'
import { hasLiveBrowserGuest } from './browser-pane/host-guest/webview-registry'
import {
  destroyWorktreeBrowserGuests,
  discardBrowserGuests
} from '../store/slices/browser-webview-cleanup'
import { selectWorktreeAgentActivitySummary } from './sidebar/worktree-agent-activity-summary'
import type { TerminalParkingFoundation } from './use-terminal-parking-foundation'

export function useTerminalBrowserRetention(controller: TerminalParkingFoundation): void {
  const {
    browserGuestRetentionBudgetEnabled,
    browserGuestRetentionRevision,
    browserGuestWorktreeRecencyRef,
    mountedWorktreeIdsRef,
    renderedActiveWorktreeId,
    setBrowserGuestRetentionRevision,
    workspaceSurfaceIds,
    workspaceSurfaceIdSet
  } = controller

  useEffect(() => {
    const invalidateRetention = (): void => {
      setBrowserGuestRetentionRevision((revision) => revision + 1)
    }
    const removeDownloadTracking = installBrowserPageDownloadActivityTracking(invalidateRetention)
    const removePaintRetentionTracking = onBrowserGuestPaintRetentionChange(invalidateRetention)
    return () => {
      removeDownloadTracking()
      removePaintRetentionTracking()
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the controller setter preserves its original stable identity.
  }, [])

  useEffect(() => {
    if (!renderedActiveWorktreeId) {
      return
    }
    const recency = browserGuestWorktreeRecencyRef.current
    touchBrowserGuestWorktreeRecency(recency, renderedActiveWorktreeId)
    for (let index = recency.length - 1; index >= 0; index--) {
      if (!workspaceSurfaceIdSet.has(recency[index])) {
        recency.splice(index, 1)
      }
    }
    if (!browserGuestRetentionBudgetEnabled) {
      return
    }
    const state = useAppStore.getState()
    const recencyIds = new Set(recency)
    const orderedWorktreeIds = [
      ...recency,
      ...workspaceSurfaceIds.filter((id) => !recencyIds.has(id))
    ]
    const evictedWorktreeIds = selectBrowserGuestEvictionWorktreeIds({
      orderedWorktreeIds,
      activeWorktreeId: renderedActiveWorktreeId,
      isRetained: (worktreeId) => mountedWorktreeIdsRef.current.has(worktreeId),
      holdsLiveGuests: (worktreeId) =>
        worktreeHoldsLiveBrowserGuests(
          state.browserTabsByWorktree[worktreeId] ?? [],
          state.browserPagesByWorkspace,
          hasLiveBrowserGuest
        ),
      // Why a shared veto: destroying a guest must respect every paint-retention signal (including
      // remote viewers) as well as active downloads, matching the overlay's mount predicate.
      isEvictable: (worktreeId) =>
        !browserTabsVetoGuestEviction(state.browserTabsByWorktree[worktreeId] ?? [])
    })
    for (const worktreeId of evictedWorktreeIds) {
      destroyWorktreeBrowserGuests(
        state.browserTabsByWorktree,
        state.browserPagesByWorkspace,
        worktreeId
      )
    }
    const evicted = new Set(evictedWorktreeIds)
    discardBrowserGuests(
      selectHiddenWorktreeBrowserGuestDiscards({
        worktreeIds: orderedWorktreeIds,
        activeWorktreeId: renderedActiveWorktreeId,
        isRetained: (worktreeId) =>
          !evicted.has(worktreeId) && mountedWorktreeIdsRef.current.has(worktreeId),
        isAgentActive: (worktreeId) => {
          const agents = selectWorktreeAgentActivitySummary(state, worktreeId)
          return agents.hasLiveWorking || agents.hasPermission || agents.hasLiveMonitoring
        },
        browserTabsByWorktree: state.browserTabsByWorktree,
        browserPagesByWorkspace: state.browserPagesByWorkspace,
        activeBrowserTabIdByWorktree: state.activeBrowserTabIdByWorktree,
        hasLiveGuest: hasLiveBrowserGuest,
        vetoesDiscard: browserPageVetoesGuestDiscard
      })
    )
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- controller refs preserve their original stable identities.
  }, [
    renderedActiveWorktreeId,
    workspaceSurfaceIds,
    browserGuestRetentionBudgetEnabled,
    browserGuestRetentionRevision
  ])
}
