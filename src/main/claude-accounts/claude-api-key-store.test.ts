import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ClaudeApiKeyStore from './claude-api-key-store'

const FAKE_KEY = 'sk-ant-test-fake'
const secretStore = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`)),
  decryptString: vi.fn((value: Buffer) => value.toString('utf8').replace(/^enc:/, ''))
}))
const fsMock = vi.hoisted(() => ({ existsSync: vi.fn(), readFileSync: vi.fn(), rmSync: vi.fn() }))
const secureFile = vi.hoisted(() => ({
  hardenExistingSecureFile: vi.fn(),
  writeSecureFile: vi.fn()
}))

vi.mock('../../shared/secret-store', () => ({ getSecretStore: () => secretStore }))
vi.mock('node:fs', () => fsMock)
vi.mock('node:os', () => ({ homedir: () => '/home/test' }))
vi.mock('node:path', () => ({ join: (...parts: string[]) => parts.join('/') }))
vi.mock('../../shared/secure-file', () => secureFile)

const keyFile = '/home/test/.dolphin/claude-api-keys/acct-1.enc'
const envelope = (kind: string, payload: string): string =>
  `dolphin-claude-api-key:v1:${kind}:${Buffer.from(payload, 'utf8').toString('base64')}`

async function loadStore(): Promise<typeof ClaudeApiKeyStore> {
  return await import('./claude-api-key-store')
}

describe('claude-api-key-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secretStore.isEncryptionAvailable.mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('writes one encrypted file per account', async () => {
    const store = await loadStore()
    store.saveClaudeApiKey('acct-1', `  ${FAKE_KEY}  `)
    expect(secureFile.writeSecureFile).toHaveBeenCalledWith(
      keyFile,
      envelope('encrypted', `enc:${FAKE_KEY}`)
    )
  })

  it('refuses to save when secure storage is unavailable', async () => {
    secretStore.isEncryptionAvailable.mockReturnValue(false)
    const store = await loadStore()
    expect(() => store.saveClaudeApiKey('acct-1', FAKE_KEY)).toThrow(/Secure storage/)
    expect(secureFile.writeSecureFile).not.toHaveBeenCalled()
  })

  it('never returns a plaintext envelope', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(Buffer.from(envelope('plaintext', FAKE_KEY)))
    const store = await loadStore()
    expect(() => store.readClaudeApiKey('acct-1')).toThrow(/could not be decrypted/)
  })

  it("never reads another store's envelope", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(
      Buffer.from(
        `dolphin-deepseek-api-key:v1:encrypted:${Buffer.from(`enc:${FAKE_KEY}`).toString('base64')}`
      )
    )
    const store = await loadStore()
    expect(() => store.readClaudeApiKey('acct-1')).toThrow(/could not be decrypted/)
  })

  it('decrypts a saved key and reports only its presence as status', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(Buffer.from(envelope('encrypted', `enc:${FAKE_KEY}`)))
    const store = await loadStore()
    expect(store.readClaudeApiKey('acct-1')).toBe(FAKE_KEY)
    expect(store.getClaudeApiKeyStatus('acct-1')).toEqual({
      apiKeyConfigured: true,
      encryptionAvailable: true
    })
  })

  it('rejects an account id that could escape the key folder', async () => {
    const store = await loadStore()
    expect(() => store.saveClaudeApiKey('../settings', FAKE_KEY)).toThrow(/Invalid/)
    expect(() => store.clearClaudeApiKey('a/b')).toThrow(/Invalid/)
  })

  it('removes the key file', async () => {
    const store = await loadStore()
    store.clearClaudeApiKey('acct-1')
    expect(fsMock.rmSync).toHaveBeenCalledWith(keyFile, { force: true })
  })
})
