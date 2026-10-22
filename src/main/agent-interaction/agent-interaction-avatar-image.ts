import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, normalize } from 'node:path'
import type { AgentInteractionAvatarImageResult } from '../../shared/agent-interaction-avatar-ipc'
import type { AgentInteractionSettings } from '../../shared/agent-interaction-settings'
import { classifyFile } from '../ipc/pet-image-formats'

// Why: the avatar is a 48px thumbnail; anything larger is a mistake, not artwork.
const MAX_AVATAR_IMAGE_BYTES = 5 * 1024 * 1024

/** The user's avatar image, or `default` when none is set; the renderer never sees the path. */
export async function readAgentInteractionAvatarImage(
  settings: AgentInteractionSettings
): Promise<AgentInteractionAvatarImageResult> {
  const { source, customImagePath } = settings.avatar
  if (source !== 'custom' || !customImagePath) {
    return { ok: false, reason: 'default' }
  }
  const path = normalize(customImagePath)
  if (!isAbsolute(path)) {
    return { ok: false, reason: 'invalid-path' }
  }
  const format = classifyFile(path)
  if (!format) {
    return { ok: false, reason: 'unsupported-type' }
  }
  try {
    const fileStat = await stat(path)
    if (!fileStat.isFile()) {
      return { ok: false, reason: 'invalid-path' }
    }
    if (fileStat.size > MAX_AVATAR_IMAGE_BYTES) {
      return { ok: false, reason: 'too-large' }
    }
    return { ok: true, data: new Uint8Array(await readFile(path)), mimeType: format.mimeType }
  } catch {
    return { ok: false, reason: 'read-failed' }
  }
}
