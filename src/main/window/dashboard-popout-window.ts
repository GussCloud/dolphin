import type { BrowserWindow, WebContents } from 'electron'
import type { Store } from '../persistence'
import { sendToTrustedUIRenderer } from '../ipc/ui'
import type { UIZoomDirection } from '../../shared/ui-zoom-level'
import { createCompanionPopoutWindow, type CompanionPopoutOptions } from './companion-popout-window'

// In-process listeners (the dashboard relay clears its cached snapshot on close).
const popoutOpenListeners = new Set<(open: boolean) => void>()

const dashboardPopout = createCompanionPopoutWindow({
  logTag: 'dashboard-popout',
  title: 'Dolphin Agent Dashboard',
  partition: 'dolphin-dashboard-popout',
  htmlEntry: 'popout.html',
  boundsKey: 'dashboardPopoutBounds',
  // Why: the main renderer's snapshot publisher only runs while the pop-out is
  // open. Tell that exact window when the state flips, then notify listeners.
  onOpenChanged: (open) => {
    sendToTrustedUIRenderer('dashboard:popoutOpenChanged', open)
    for (const listener of popoutOpenListeners) {
      listener(open)
    }
  }
})

/** The live pop-out window, or null when closed. Used by the dashboard relay to
 *  forward snapshots to the popout's webContents. */
export function getDashboardPopoutWindow(): BrowserWindow | null {
  return dashboardPopout.getWindow()
}

export function isDashboardPopoutRenderer(sender: WebContents): boolean {
  return dashboardPopout.isRenderer(sender)
}

/** Zoom the pop-out when it is the focused window; false routes the menu action elsewhere. */
export function zoomDashboardPopoutIfFocused(direction: UIZoomDirection): boolean {
  return dashboardPopout.zoomIfFocused(direction)
}

/** Subscribe to pop-out open/close transitions in the main process. */
export function onDashboardPopoutOpenChanged(listener: (open: boolean) => void): () => void {
  popoutOpenListeners.add(listener)
  return () => popoutOpenListeners.delete(listener)
}

/** Open the pop-out dashboard window, or focus it if already open. */
export function createOrFocusDashboardPopout(
  store: Store | null,
  options: CompanionPopoutOptions = {}
): BrowserWindow {
  return dashboardPopout.createOrFocus(store, options)
}

/** Close the pop-out dashboard if it is open (the main window is closing). */
export function closeDashboardPopout(): void {
  dashboardPopout.close()
}
