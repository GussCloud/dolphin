import { ipcMain } from 'electron'
import { extname, normalize } from 'node:path'
import type { Store } from '../persistence'
import type { NotificationSoundDataResult } from '../../shared/notification-settings-types'
import {
  getSelectedNotificationSoundPath,
  NOTIFICATION_SOUND_MIME_BY_EXTENSION
} from './notification-sound-selection'
import { readNotificationSoundFile } from './notification-sound-file'

export function registerNotificationSoundHandlers(store: Store): void {
  // Why: return the path so the preload's path-keyed cache skips the 10MB IPC round-trip on repeat dispatches.
  ipcMain.removeHandler('notifications:resolveSoundPath')
  ipcMain.handle(
    'notifications:resolveSoundPath',
    ():
      | { ok: true; path: string }
      | { ok: false; reason: 'missing-path' | 'invalid-path' | 'unsupported-type' } => {
      const selectedSound = getSelectedNotificationSoundPath(store.getSettings().notifications)
      if (!selectedSound.path) {
        return { ok: false, reason: selectedSound.reason ?? 'missing-path' }
      }
      const normalizedPath = normalize(selectedSound.path)
      if (!NOTIFICATION_SOUND_MIME_BY_EXTENSION.has(extname(normalizedPath).toLowerCase())) {
        return { ok: false, reason: 'unsupported-type' }
      }
      return { ok: true, path: normalizedPath }
    }
  )

  ipcMain.removeHandler('notifications:loadSound')
  ipcMain.handle('notifications:loadSound', async (): Promise<NotificationSoundDataResult> => {
    const selectedSound = getSelectedNotificationSoundPath(store.getSettings().notifications)
    if (!selectedSound.path) {
      return { ok: false, reason: selectedSound.reason ?? 'missing-path' }
    }

    return readNotificationSoundFile(selectedSound.path)
  })
}
