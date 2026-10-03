import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import {
  TERMINAL_WORKTREE_HOT_RETAIN_MS,
  canParkTerminalWorktreeRenderers,
  type ColdParkableTerminalTab,
  type TerminalParkRestorePolicy
} from '../terminal-pane/terminal-hidden-view-parking'

// Why: a closed panel is only CSS-hidden, and per-tab hot-retain spares its last-active tab
// forever. Past the worktree hot-retain window the whole panel parks like a background worktree.
export const CLOSED_FLOATING_PANEL_PARK_DELAY_MS = TERMINAL_WORKTREE_HOT_RETAIN_MS
// Why: restore capability (provider snapshot, paired host) can resolve without any tab-model write.
export const CLOSED_FLOATING_PANEL_INELIGIBLE_RECHECK_MS = 30_000

export type ClosedFloatingPanelParkVerdict = {
  park: boolean
  /** When to re-evaluate without an input change; null means only input changes matter. */
  recheckDelayMs: number | null
}

export function decideClosedFloatingPanelPark(args: {
  open: boolean
  closedSinceMs: number | null
  terminalTabs: readonly ColdParkableTerminalTab[]
  pendingStartupByTabId: Readonly<Record<string, unknown>>
  parkingEnabled: boolean
  nowMs: number
  restorePolicy?: TerminalParkRestorePolicy
  closedParkDelayMs?: number
  canWatcherCoverTab: (tab: ColdParkableTerminalTab) => boolean
}): ClosedFloatingPanelParkVerdict {
  if (
    args.open ||
    !args.parkingEnabled ||
    args.closedSinceMs === null ||
    args.terminalTabs.length === 0
  ) {
    return { park: false, recheckDelayMs: null }
  }
  const closedParkDelayMs = args.closedParkDelayMs ?? CLOSED_FLOATING_PANEL_PARK_DELAY_MS
  const remainingMs = args.closedSinceMs + closedParkDelayMs - args.nowMs
  if (remainingMs > 0) {
    return { park: false, recheckDelayMs: remainingMs }
  }
  // Why the worktree predicate: unmounting every pane is only safe when each one restores on
  // reopen and a byte watcher covers its side effects meanwhile — the background-worktree contract.
  const parkable =
    canParkTerminalWorktreeRenderers({
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      terminalTabs: args.terminalTabs,
      pendingStartupByTabId: args.pendingStartupByTabId,
      parkingEnabled: args.parkingEnabled,
      isVisible: false,
      shouldMeasureHiddenWorktree: false,
      hasActivityTerminalPortal: false,
      hiddenSinceMs: args.closedSinceMs,
      nowMs: args.nowMs,
      coldParkDelayMs: closedParkDelayMs,
      ...(args.restorePolicy ? { restorePolicy: args.restorePolicy } : {})
    }) && args.terminalTabs.every((tab) => args.canWatcherCoverTab(tab))
  return parkable
    ? { park: true, recheckDelayMs: null }
    : { park: false, recheckDelayMs: CLOSED_FLOATING_PANEL_INELIGIBLE_RECHECK_MS }
}
