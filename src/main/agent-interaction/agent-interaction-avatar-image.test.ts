import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mergeAgentInteractionSettings } from '../../shared/agent-interaction-settings'
import { readAgentInteractionAvatarImage } from './agent-interaction-avatar-image'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dolphin-avatar-image-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function withImage(customImagePath: string) {
  return mergeAgentInteractionSettings(undefined, {
    avatar: { source: 'custom', customImagePath }
  })
}

describe('readAgentInteractionAvatarImage', () => {
  it('reports the default avatar when no custom image is chosen', async () => {
    await expect(
      readAgentInteractionAvatarImage(mergeAgentInteractionSettings(undefined, {}))
    ).resolves.toEqual({ ok: false, reason: 'default' })
  })

  it('reads a chosen image with its mime type', async () => {
    const path = join(dir, 'me.png')
    writeFileSync(path, Buffer.from([1, 2, 3]))
    await expect(readAgentInteractionAvatarImage(withImage(path))).resolves.toEqual({
      ok: true,
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png'
    })
  })

  it('refuses unsupported, relative and missing files', async () => {
    const text = join(dir, 'me.txt')
    writeFileSync(text, 'x')
    await expect(readAgentInteractionAvatarImage(withImage(text))).resolves.toEqual({
      ok: false,
      reason: 'unsupported-type'
    })
    await expect(readAgentInteractionAvatarImage(withImage('me.png'))).resolves.toEqual({
      ok: false,
      reason: 'invalid-path'
    })
    await expect(
      readAgentInteractionAvatarImage(withImage(join(dir, 'gone.png')))
    ).resolves.toEqual({ ok: false, reason: 'read-failed' })
  })
})
