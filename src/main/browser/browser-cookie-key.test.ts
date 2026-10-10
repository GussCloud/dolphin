import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DetectedBrowser } from './browser-cookie-detection-types'

const { runProcessMock } = vi.hoisted(() => ({ runProcessMock: vi.fn() }))

vi.mock('../../shared/child-process/run-process', () => ({ runProcess: runProcessMock }))
vi.mock('./browser-cookie-import-diagnostics', () => ({ diag: vi.fn() }))

const chrome: DetectedBrowser = {
  family: 'chrome',
  label: 'Google Chrome',
  cookiesPath: '',
  keychainService: 'Chrome Safe Storage',
  keychainAccount: 'Chrome',
  profiles: [{ name: 'Default', directory: 'Default' }],
  selectedProfile: 'Default'
}

describe('getWindowsEncryptionKey', () => {
  let localAppData: string
  let platformSpy: { mockRestore: () => void }
  const originalLocalAppData = process.env.LOCALAPPDATA

  beforeEach(() => {
    localAppData = mkdtempSync(join(tmpdir(), 'cookie-key-'))
    process.env.LOCALAPPDATA = localAppData
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const root = join(localAppData, 'Google/Chrome/User Data')
    mkdirSync(root, { recursive: true })
    const encryptedKey = Buffer.concat([Buffer.from('DPAPI'), Buffer.from('sealed')])
    writeFileSync(
      join(root, 'Local State'),
      JSON.stringify({ os_crypt: { encrypted_key: encryptedKey.toString('base64') } })
    )
    runProcessMock.mockReset()
  })

  afterEach(() => {
    platformSpy.mockRestore()
    process.env.LOCALAPPDATA = originalLocalAppData
    rmSync(localAppData, { recursive: true, force: true })
  })

  it('decrypts the master key off the main thread with the DPAPI blob on stdin', async () => {
    const masterKey = Buffer.alloc(32, 7)
    runProcessMock.mockResolvedValue({
      code: 0,
      signal: null,
      stdout: `${masterKey.toString('base64')}\r\n`,
      stderr: '',
      timedOut: false
    })
    const { getWindowsEncryptionKey } = await import('./browser-cookie-key')

    const pending = getWindowsEncryptionKey(chrome)

    expect(pending).toBeInstanceOf(Promise)
    await expect(pending).resolves.toEqual({ key: masterKey, mode: 'aes-256-gcm' })
    expect(runProcessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        program: expect.stringMatching(/powershell\.exe$/i),
        input: Buffer.from('sealed').toString('base64'),
        timeoutMs: 10_000
      })
    )
  })

  it('returns null when PowerShell cannot unprotect the key', async () => {
    runProcessMock.mockResolvedValue({
      code: 1,
      signal: null,
      stdout: '',
      stderr: 'denied',
      timedOut: false
    })
    const { getWindowsEncryptionKey } = await import('./browser-cookie-key')

    await expect(getWindowsEncryptionKey(chrome)).resolves.toBeNull()
  })
})
