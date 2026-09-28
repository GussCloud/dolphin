import { BrowserWindow } from 'electron'
import { DOLPHIN_PROFILE_AUTH_STATUS_CHANGED_CHANNEL } from '../../shared/dolphin-profiles'

export function broadcastDolphinProfileAuthStatusChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }
    try {
      window.webContents.send(DOLPHIN_PROFILE_AUTH_STATUS_CHANGED_CHANNEL)
    } catch {
      // A renderer can disappear between isDestroyed() and send().
    }
  }
}
