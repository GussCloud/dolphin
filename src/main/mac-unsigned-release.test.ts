import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalPlatform = process.platform
const originalResourcesPath = process.resourcesPath

async function probe(platform: NodeJS.Platform, withMarker: boolean): Promise<boolean> {
  const dir = mkdtempSync(path.join(tmpdir(), 'mac-unsigned-'))
  try {
    const { MAC_UNSIGNED_RELEASE_MARKER } = await import('./mac-unsigned-release')
    if (withMarker) {
      writeFileSync(path.join(dir, MAC_UNSIGNED_RELEASE_MARKER), '')
    }
    vi.resetModules()
    Object.defineProperty(process, 'platform', { value: platform, configurable: true })
    Object.defineProperty(process, 'resourcesPath', { value: dir, configurable: true })
    const { isUnsignedMacRelease } = await import('./mac-unsigned-release')
    return isUnsignedMacRelease()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('isUnsignedMacRelease', () => {
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    Object.defineProperty(process, 'resourcesPath', {
      value: originalResourcesPath,
      configurable: true
    })
  })

  it('is true only for a macOS build that carries the marker', async () => {
    expect(await probe('darwin', true)).toBe(true)
    expect(await probe('darwin', false)).toBe(false)
    expect(await probe('linux', true)).toBe(false)
  })
})
