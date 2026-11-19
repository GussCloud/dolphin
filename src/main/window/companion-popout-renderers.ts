import type { WebContents } from 'electron'
import { isDashboardPopoutRenderer } from './dashboard-popout-window'
import { isDesignPopoutRenderer } from './design-popout-window'

/** The exact webContents of a live pop-out window (agent dashboard or Design). */
export function isCompanionPopoutRenderer(sender: WebContents): boolean {
  return isDashboardPopoutRenderer(sender) || isDesignPopoutRenderer(sender)
}
