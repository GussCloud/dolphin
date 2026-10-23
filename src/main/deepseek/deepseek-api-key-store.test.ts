import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DeepSeekApiKeyStore from './deepseek-api-key-store'

const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`)),
  decryptString: vi.fn((value: Buffer) => value.toString('utf8').replace(/^enc:/, ''))
}))
const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn()
}))
const secureFileMock = vi.hoisted(() => ({
  hardenExistingSecureFile: vi.fn(),
  writeSecureFile: vi.fn()
}))

vi.mock('../../shared/secret-store', () => ({ getSecretStore: () => safeStorageMock }))
vi.mock('node:fs', () => fsMock)
vi.mock('node:os', () => ({ homedir: () => '/home/test' }))
vi.mock('node:path', () => ({ join: (...parts: string[]) => parts.join('/') }))
vi.mock('../../shared/secure-file', () => secureFileMock)

const storePath = '/home/test/.dolphin/deepseek-api-key.enc'
const envelope = (kind: 'encrypted' | 'plaintext', payload: string): string =>
  `dolphin-deepseek-api-key:v1:${kind}:${Buffer.from(payload, 'utf8').toString('base64')}`

async function loadStore(): Promise<typeof DeepSeekApiKeyStore> {
  return await import('./deepseek-api-key-store')
}

describe('deepseek-api-key-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('reports no key and reads null when the file does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false)
    const store = await loadStore()
    expect(store.hasDeepSeekApiKey()).toBe(false)
    expect(store.readDeepSeekApiKey()).toBeNull()
  })

  it('writes a safeStorage envelope to its own file, separate from MiniMax', async () => {
    const store = await loadStore()
    store.saveDeepSeekApiKey('  sk-deepseek  ')
    expect(safeStorageMock.encryptString).toHaveBeenCalledWith('sk-deepseek')
    expect(secureFileMock.writeSecureFile).toHaveBeenCalledWith(
      storePath,
      envelope('encrypted', 'enc:sk-deepseek')
    )
  })

  it('refuses an empty key', async () => {
    const store = await loadStore()
    expect(() => store.saveDeepSeekApiKey('   ')).toThrow(/required/)
    expect(secureFileMock.writeSecureFile).not.toHaveBeenCalled()
  })

  it('decrypts a saved key from disk', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(Buffer.from(envelope('encrypted', 'enc:sk-disk')))
    const store = await loadStore()
    expect(store.readDeepSeekApiKey()).toBe('sk-disk')
  })

  it('throws instead of returning a key from another envelope', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(Buffer.from('dolphin-minimax-api-key:v1:plaintext:eA=='))
    const store = await loadStore()
    expect(() => store.readDeepSeekApiKey()).toThrow(/could not be decrypted/)
  })

  it('refuses to save when secure storage is unavailable and leaves the file untouched', async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false)
    const store = await loadStore()
    expect(() => store.saveDeepSeekApiKey('sk-deepseek')).toThrow(
      store.DEEPSEEK_SECURE_STORAGE_UNAVAILABLE_MESSAGE
    )
    expect(secureFileMock.writeSecureFile).not.toHaveBeenCalled()
    fsMock.existsSync.mockReturnValue(false)
    expect(store.readDeepSeekApiKey()).toBeNull()
  })

  it('rejects a plaintext envelope on read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(Buffer.from(envelope('plaintext', 'sk-plain')))
    const store = await loadStore()
    expect(() => store.readDeepSeekApiKey()).toThrow(/could not be decrypted/)
  })

  it('clears the cached key and the file', async () => {
    const store = await loadStore()
    store.saveDeepSeekApiKey('sk-1')
    store.clearDeepSeekApiKey()
    fsMock.existsSync.mockReturnValue(false)
    expect(fsMock.rmSync).toHaveBeenCalledWith(storePath, { force: true })
    expect(store.readDeepSeekApiKey()).toBeNull()
  })
})
