import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { captureParkedTerminalBuffers } from '../terminal-pane/parked-terminal-buffer-capture'
import { selectPairedRuntimeParkingEnvironmentIdsFromState } from '../terminal-pane/terminal-hidden-view-parking'
import { getTerminalParkingPolicyOverrides } from '../terminal-pane/terminal-parking-e2e-overrides'
import { canWatcherCoverParkedTerminalTab } from '../terminal-pane/terminal-parked-tab-watchers'
import { usePendingStartupParkPresence } from '../terminal-pane/terminal-pending-startup-park-presence'
import {
  CLOSED_FLOATING_PANEL_INELIGIBLE_RECHECK_MS,
  decideClosedFloatingPanelPark
} from './closed-floating-panel-parking'

/** Whole-panel park verdict for the closed floating panel, fed to per-tab parking as the
 *  worktree-level verdict. Reopening clears it in the same render. */
export function useClosedFloatingPanelParking(args: {
  open: boolean
  terminalTabs: readonly TerminalTab[]
}): boolean {
  const { open, terminalTabs } = args
  const pendingStartupByTabId = usePendingStartupParkPresence(terminalTabs)
  const parkingEnabled = useAppStore((state) => state.settings?.terminalHiddenViewParking !== false)
  const sshParkingEnabled = useAppStore((state) => state.settings?.terminalSshViewParking !== false)
  const pairedRuntimeParkingEnvironmentIds = useAppStore(
    selectPairedRuntimeParkingEnvironmentIdsFromState
  )
  const closedSinceMsRef = useRef<number | null>(null)
  const capturedRef = useRef(false)
  const [recheckRevision, setRecheckRevision] = useState(0)
  const [parked, setParked] = useState(false)
  // Why a ref mirror: this effect re-runs on every tab-model write, and a no-op dispatch inside a
  // commit cascade counts toward React's nested-update limit (see use-terminal-tab-cold-parking).
  const parkedRef = useRef(parked)

  useEffect(() => {
    const nowMs = Date.now()
    if (open) {
      closedSinceMsRef.current = null
    } else {
      closedSinceMsRef.current ??= nowMs
    }
    const overrides = getTerminalParkingPolicyOverrides()
    const verdict = decideClosedFloatingPanelPark({
      open,
      closedSinceMs: closedSinceMsRef.current,
      terminalTabs,
      pendingStartupByTabId,
      parkingEnabled,
      nowMs,
      restorePolicy: { sshParkingEnabled, pairedRuntimeParkingEnvironmentIds },
      ...(overrides.hotRetainMs !== undefined ? { closedParkDelayMs: overrides.hotRetainMs } : {}),
      canWatcherCoverTab: (tab) =>
        canWatcherCoverParkedTerminalTab(FLOATING_TERMINAL_WORKTREE_ID, tab)
    })
    let park = verdict.park
    let recheckDelayMs = verdict.recheckDelayMs
    if (!park) {
      capturedRef.current = false
    } else if (!capturedRef.current) {
      // Why before the commit: the panes are still mounted, the last moment a remote pane's
      // xterm — possibly the only client-side copy — can be serialized. Incomplete → retry later.
      capturedRef.current = captureParkedTerminalBuffers({
        worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        tabIds: terminalTabs.map((tab) => tab.id),
        repos: useAppStore.getState().repos ?? [],
        localOnly: true
      })
      if (!capturedRef.current) {
        park = false
        recheckDelayMs = CLOSED_FLOATING_PANEL_INELIGIBLE_RECHECK_MS
      }
    }
    if (parkedRef.current !== park) {
      parkedRef.current = park
      setParked(park)
    }
    if (recheckDelayMs === null) {
      return undefined
    }
    const timer = window.setTimeout(
      () => setRecheckRevision((revision) => revision + 1),
      recheckDelayMs
    )
    return () => window.clearTimeout(timer)
  }, [
    open,
    pairedRuntimeParkingEnvironmentIds,
    parkingEnabled,
    pendingStartupByTabId,
    recheckRevision,
    sshParkingEnabled,
    terminalTabs
  ])

  return parked && !open
}
