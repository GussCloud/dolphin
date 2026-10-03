import { useMemo, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store'
import {
  getHibernatedWakeMountRequests,
  selectPendingHibernatedWakeMountTabIds,
  subscribeHibernatedWakeMountRequests
} from '@/lib/hibernated-wake-mount-requests'
import {
  selectHibernatedTerminalTabIds,
  selectParkedHibernatedTerminalTabs
} from './hibernated-terminal-tabs'

export type HibernatedTerminalTabParking = {
  hibernatedTabIds: ReadonlySet<string>
  /** Hibernated tabs a background wake must reach, so they stay mounted until it consumes them. */
  wakeRequestedTabIds: ReadonlySet<string>
}

export function useHibernatedTerminalTabParking(worktreeId: string): HibernatedTerminalTabParking {
  const hibernatedTabIds = useAppStore(
    useShallow((state) => selectHibernatedTerminalTabIds(state, worktreeId))
  )
  const wakeMountRequests = useSyncExternalStore(
    subscribeHibernatedWakeMountRequests,
    getHibernatedWakeMountRequests,
    getHibernatedWakeMountRequests
  )
  const wakeRequestedTabIds = useAppStore(
    useShallow((state) =>
      selectPendingHibernatedWakeMountTabIds(
        wakeMountRequests,
        state.sleepingAgentSessionsByPaneKey
      )
    )
  )
  return useMemo(
    () => ({ hibernatedTabIds, wakeRequestedTabIds }),
    [hibernatedTabIds, wakeRequestedTabIds]
  )
}

export function addParkedHibernatedTerminalTabs(
  parkedTabIds: Set<string>,
  parking: HibernatedTerminalTabParking,
  args: Omit<
    Parameters<typeof selectParkedHibernatedTerminalTabs>[0],
    'hibernatedTabIds' | 'wakeRequestedTabIds'
  >
): void {
  for (const tabId of selectParkedHibernatedTerminalTabs({ ...args, ...parking })) {
    parkedTabIds.add(tabId)
  }
}

/** Render-time gate for a tab the park policy selected. Why the measure carve-out: a hibernated
 *  tab has nothing to fit, and remounting it would resume its agent while hidden. */
export function canRenderParkHibernationAware(
  parking: HibernatedTerminalTabParking,
  tabId: string,
  shouldMeasureHiddenWorktree: boolean
): boolean {
  if (!parking.hibernatedTabIds.has(tabId)) {
    return !shouldMeasureHiddenWorktree
  }
  return !parking.wakeRequestedTabIds.has(tabId)
}

/** Why: a parked hibernated tab's leaf still names its killed PTY; a watcher on it would publish
 *  that dead PTY as a live parked owner to the runtime graph. */
export function useWatchedParkedTerminalTabIds(
  parkedTabIds: ReadonlySet<string>,
  hibernatedTabIds: ReadonlySet<string>
): ReadonlySet<string> {
  return useMemo(() => {
    if (hibernatedTabIds.size === 0) {
      return parkedTabIds
    }
    const watched = new Set<string>()
    for (const tabId of parkedTabIds) {
      if (!hibernatedTabIds.has(tabId)) {
        watched.add(tabId)
      }
    }
    return watched.size === parkedTabIds.size ? parkedTabIds : watched
  }, [hibernatedTabIds, parkedTabIds])
}
