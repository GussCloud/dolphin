import { readFile, stat } from 'node:fs/promises'
import { extname, normalize } from 'node:path'
import type { NotificationSoundDataResult } from '../../shared/notification-settings-types'
import { NOTIFICATION_SOUND_MIME_BY_EXTENSION } from './notification-sound-selection'

const MAX_NOTIFICATION_SOUND_BYTES = 10 * 1024 * 1024

/** Reads a sound the main process already chose; a renderer never supplies the path. */
export async function readNotificationSoundFile(path: string): Promise<NotificationSoundDataResult> {
  const normalizedPath = normalize(path)
  const mimeType = NOTIFICATION_SOUND_MIME_BY_EXTENSION.get(extname(normalizedPath).toLowerCase())
  if (!mimeType) {
    return { ok: false, reason: 'unsupported-type' }
  }
  try {
    const fileStat = await stat(normalizedPath)
    if (!fileStat.isFile()) {
      return { ok: false, reason: 'invalid-path' }
    }
    if (fileStat.size > MAX_NOTIFICATION_SOUND_BYTES) {
      return { ok: false, reason: 'too-large' }
    }
    const data = await readFile(normalizedPath)
    return { ok: true, data: new Uint8Array(data), mimeType, path: normalizedPath }
  } catch {
    return { ok: false, reason: 'read-failed' }
  }
}
