import { describe, expect, it, vi } from 'vitest'
import type { SecretStore } from '../../shared/secret-store'
import { parseTelegramSettingsFile, TelegramSettingsStore } from './telegram-settings'

const TOKEN = '123456789:AAEabcdefghijklmnopqrstuvwxyz012345'

function secretStore(available = true): SecretStore {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (text) => Buffer.from(`sealed:${text}`),
    decryptString: (cipher) => cipher.toString().replace(/^sealed:/, ''),
    describeProtectionGap: () => (available ? null : 'keychain unavailable')
  }
}

function makeStore(options: { available?: boolean; now?: () => number } = {}) {
  const files = new Map<string, string>()
  const store = new TelegramSettingsStore({
    filePath: 'telegram.json',
    secretStore: secretStore(options.available),
    now: options.now,
    readFile: (path) => files.get(path) ?? null,
    writeFile: (path, value) => files.set(path, JSON.stringify(value))
  })
  return { store, files }
}

describe('TelegramSettingsStore', () => {
  it('seals the token and never writes it in plain text', () => {
    const { store, files } = makeStore()
    store.setToken(` ${TOKEN} `)
    expect(files.get('telegram.json')).not.toContain(TOKEN)
    expect(store.getSnapshot()).toMatchObject({ tokenConfigured: true, protectionGap: null })
    const reloaded = new TelegramSettingsStore({
      filePath: 'telegram.json',
      secretStore: secretStore(),
      readFile: (path) => files.get(path) ?? null,
      writeFile: () => {}
    })
    expect(reloaded.readToken()).toBe(TOKEN)
  })

  it('reports the protection gap when it must fall back to plain text', () => {
    const { store } = makeStore({ available: false })
    store.setToken(TOKEN)
    expect(store.readToken()).toBe(TOKEN)
    expect(store.getSnapshot().protectionGap).toBe('keychain unavailable')
  })

  it('rejects malformed tokens', () => {
    const { store } = makeStore()
    expect(() => store.setToken('not-a-token')).toThrow(/invalid/)
  })

  it('clearing the token also disables the bridge', () => {
    const { store } = makeStore()
    store.setToken(TOKEN)
    store.setEnabled(true)
    store.clearToken()
    expect(store.getSnapshot()).toMatchObject({ enabled: false, tokenConfigured: false })
    expect(store.readToken()).toBeNull()
  })

  it('pairs a chat with a one-time code and allowlists it', () => {
    const { store } = makeStore()
    const listener = vi.fn()
    store.onChange(listener)
    const { code } = store.issuePairingCode()
    expect(store.consumePairingCode(code.toLowerCase(), { chatId: 42, label: '@me' })).toBe(true)
    expect(store.isChatAllowed(42)).toBe(true)
    expect(listener).toHaveBeenCalled()
    expect(store.getPairingCode()).toBeNull()
    expect(store.consumePairingCode(code, { chatId: 43, label: 'x' })).toBe(false)
    expect(store.isChatAllowed(43)).toBe(false)
  })

  it('expires the code and burns it after repeated misses', () => {
    let now = 0
    const { store } = makeStore({ now: () => now })
    const first = store.issuePairingCode()
    now = 10 * 60_000
    expect(store.consumePairingCode(first.code, { chatId: 1, label: '' })).toBe(false)
    const second = store.issuePairingCode()
    for (let i = 0; i < 5; i += 1) {
      expect(store.consumePairingCode('WRONG000', { chatId: 1, label: '' })).toBe(false)
    }
    expect(store.consumePairingCode(second.code, { chatId: 1, label: '' })).toBe(false)
  })

  it('persists the update offset silently and resets it with a new token', () => {
    const { store, files } = makeStore()
    const listener = vi.fn()
    store.onChange(listener)
    store.setUpdateOffset(41)
    expect(store.getUpdateOffset()).toBe(41)
    expect(JSON.parse(files.get('telegram.json') ?? '{}').updateOffset).toBe(41)
    expect(listener).not.toHaveBeenCalled()
    store.setToken(TOKEN)
    expect(store.getUpdateOffset()).toBe(0)
  })

  it('removes a chat from the allowlist', () => {
    const { store } = makeStore()
    store.consumePairingCode(store.issuePairingCode().code, { chatId: 7, label: '' })
    store.removeAllowedChat(7)
    expect(store.getAllowedChatIds()).toEqual([])
  })
})

describe('parseTelegramSettingsFile', () => {
  it('drops malformed fields instead of failing', () => {
    expect(
      parseTelegramSettingsFile({
        enabled: 'yes',
        token: { encoding: 'rot13', payload: 'x' },
        allowedChats: [{ chatId: 1.5 }, { chatId: 3, label: 'ok', pairedAt: 1 }, null]
      })
    ).toEqual({
      version: 1,
      enabled: false,
      channelsEnabled: false,
      allowedChats: [{ chatId: 3, label: 'ok', pairedAt: 1 }]
    })
  })
})
