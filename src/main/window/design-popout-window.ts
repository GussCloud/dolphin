import type { BrowserWindow, WebContents } from 'electron'
import type { Store } from '../persistence'
import { sendToTrustedUIRenderer } from '../ipc/ui'
import type { UIZoomDirection } from '../../shared/ui-zoom-level'
import { createCompanionPopoutWindow, type CompanionPopoutOptions } from './companion-popout-window'

const designPopout = createCompanionPopoutWindow({
  logTag: 'design-popout',
  title: 'Dolphin — Design',
  partition: 'dolphin-design-popout',
  htmlEntry: 'design-popout.html',
  boundsKey: 'designPopoutBounds',
  onOpenChanged: (open) => sendToTrustedUIRenderer('designPopout:openChanged', open)
})

export function getDesignPopoutWindow(): BrowserWindow | null {
  return designPopout.getWindow()
}

export function isDesignPopoutRenderer(sender: WebContents): boolean {
  return designPopout.isRenderer(sender)
}

export function zoomDesignPopoutIfFocused(direction: UIZoomDirection): boolean {
  return designPopout.zoomIfFocused(direction)
}

/** Open the Design window so it can live on another monitor, or focus it if already open. */
export function createOrFocusDesignPopout(
  store: Store | null,
  options: CompanionPopoutOptions = {}
): BrowserWindow {
  return designPopout.createOrFocus(store, options)
}

/** Close the Design window if it is open (the main window is closing). */
export function closeDesignPopout(): void {
  designPopout.close()
}
