import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import {
  findActivityTerminalPortal,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'
import { canWatcherCoverParkedTerminalTab } from './terminal-parked-tab-watchers'
import {
  canRenderParkHibernationAware,
  type HibernatedTerminalTabParking
} from './use-hibernated-terminal-tab-parking'

/** The per-tab park verdict before flip damping: which tabs render no pane this commit. */
export function selectCandidateParkedTerminalTabIds(args: {
  worktreeId: string
  terminalTabs: readonly TerminalTab[]
  assignments: ReadonlyMap<string, { isActiveInGroup: boolean }>
  isWorktreeActive: boolean
  coldParkTerminalPanes: boolean
  coldParkedTerminalTabIds: ReadonlySet<string>
  retentionParkedTerminalTabIds: ReadonlySet<string>
  sleepingRecordOwnedTabIds: ReadonlySet<string>
  evictionExemptTerminalTabIds: ReadonlySet<string>
  terminalPaneSplitMountLeaseTabIds: ReadonlySet<string>
  hibernatedParking: HibernatedTerminalTabParking
  shouldMeasureHiddenWorktree: boolean
  activityTerminalPortals: ActivityTerminalPortalTarget[]
  activationDeferredMountTabIds?: ReadonlySet<string> | null
}): Set<string> {
  const {
    worktreeId,
    terminalTabs,
    assignments,
    isWorktreeActive,
    coldParkTerminalPanes,
    coldParkedTerminalTabIds,
    retentionParkedTerminalTabIds,
    sleepingRecordOwnedTabIds,
    evictionExemptTerminalTabIds,
    terminalPaneSplitMountLeaseTabIds,
    hibernatedParking,
    shouldMeasureHiddenWorktree,
    activityTerminalPortals,
    activationDeferredMountTabIds
  } = args
  const parked = new Set<string>()
  for (const terminalTab of terminalTabs) {
    const assignment = assignments.get(terminalTab.id)
    const isVisible = Boolean(isWorktreeActive && assignment && assignment.isActiveInGroup)
    const hasActivityTerminalPortal =
      findActivityTerminalPortal(activityTerminalPortals, {
        worktreeId,
        tabId: terminalTab.id
      }) !== null
    if (
      (coldParkTerminalPanes ||
        (!isVisible &&
          (coldParkedTerminalTabIds.has(terminalTab.id) ||
            retentionParkedTerminalTabIds.has(terminalTab.id)) &&
          // Why: a pane owning a sleeping-session record must stay mountable
          // on an active worktree — parked it can never cold-restore, so the
          // agent's resume strands until the user reveals the tab. Scoped to
          // per-tab parks: the worktree-level park clears on activation.
          !sleepingRecordOwnedTabIds.has(terminalTab.id))) &&
      !hasActivityTerminalPortal &&
      // Why: a force-parked worktree's eviction-exempt tabs keep their
      // mounted panes — a remount would orphan their live pty. Scoped to
      // force-parks: ordinary parks never contain exempt tabs (eligibility
      // requires every tab restorable, so the memo is empty for them).
      !evictionExemptTerminalTabIds.has(terminalTab.id) &&
      // Why: CLI splits against a parked tab replay as soon as its exact pane remounts.
      !terminalPaneSplitMountLeaseTabIds.has(terminalTab.id) &&
      // Why: the hidden-measuring startup probe needs mounted panes; gate
      // here too so the reveal lands in the same render that starts it.
      canRenderParkHibernationAware(hibernatedParking, terminalTab.id, shouldMeasureHiddenWorktree)
    ) {
      parked.add(terminalTab.id)
    }
    // Why: activation-deferred tabs render no pane regardless of the park
    // policy, so watchers must own their side effects immediately. Targeted
    // restrictions do not enter this set or add a new eager watcher burst.
    if (
      activationDeferredMountTabIds?.has(terminalTab.id) &&
      !hasActivityTerminalPortal &&
      canWatcherCoverParkedTerminalTab(worktreeId, terminalTab)
    ) {
      parked.add(terminalTab.id)
    }
  }
  return parked
}
