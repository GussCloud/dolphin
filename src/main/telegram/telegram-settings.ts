// Telegram bridge settings: a dedicated file so the bot token never rides the
// renderer-visible GlobalSettings. The token is sealed with the host SecretStore.
import { existsSync, readFileSync } from 'node:fs'
import { randomInt, timingSafeEqual } from 'node:crypto'
import type { SecretStore } from '../../shared/secret-store'
import { writeSecureJsonFile } from '../../shared/secure-file'
import { isPlausibleTelegramBotToken } from './telegram-bot-api'

const PAIRING_CODE_TTL_MS = 10 * 60_000
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PAIRING_CODE_LENGTH = 8
const PAIRING_MAX_FAILED_ATTEMPTS = 5

export type TelegramAllowedChat = { chatId: number; label: string; pairedAt: number }

export type TelegramPairingCode = { code: string; expiresAt: number }

export type TelegramSettingsSnapshot = {
  enabled: boolean
  channelsEnabled: boolean
  tokenConfigured: boolean
  allowedChats: TelegramAllowedChat[]
  /** Non-null when the token is not protected the way a user would assume. */
  protectionGap: string | null
}

type SealedToken = { encoding: 'sealed' | 'plaintext'; payload: string }

type TelegramSettingsFile = {
  version: 1
  enabled: boolean
  channelsEnabled: boolean
  token?: SealedToken
  allowedChats: TelegramAllowedChat[]
}

const EMPTY_SETTINGS: TelegramSettingsFile = {
  version: 1,
  enabled: false,
  channelsEnabled: false,
  allowedChats: []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseAllowedChat(raw: unknown): TelegramAllowedChat | null {
  if (!isRecord(raw) || typeof raw.chatId !== 'number' || !Number.isSafeInteger(raw.chatId)) {
    return null
  }
  return {
    chatId: raw.chatId,
    label: typeof raw.label === 'string' ? raw.label : '',
    pairedAt: typeof raw.pairedAt === 'number' ? raw.pairedAt : 0
  }
}

export function parseTelegramSettingsFile(raw: unknown): TelegramSettingsFile {
  if (!isRecord(raw)) {
    return { ...EMPTY_SETTINGS }
  }
  const encoding = isRecord(raw.token) ? raw.token.encoding : undefined
  const payload = isRecord(raw.token) ? raw.token.payload : undefined
  const token: SealedToken | undefined =
    (encoding === 'sealed' || encoding === 'plaintext') && typeof payload === 'string'
      ? { encoding, payload }
      : undefined
  const allowedChats = Array.isArray(raw.allowedChats)
    ? raw.allowedChats.flatMap((chat) => parseAllowedChat(chat) ?? [])
    : []
  return {
    version: 1,
    enabled: raw.enabled === true,
    channelsEnabled: raw.channelsEnabled === true,
    ...(token ? { token } : {}),
    allowedChats
  }
}

function generatePairingCode(): string {
  let code = ''
  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
    code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)]
  }
  return code
}

function sameCode(expected: string, candidate: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(candidate.trim().toUpperCase())
  return a.length === b.length && timingSafeEqual(a, b)
}

export type TelegramSettingsStoreOptions = {
  filePath: string
  secretStore: SecretStore
  now?: () => number
  /** Test seam. */
  writeFile?: (path: string, value: unknown) => void
  readFile?: (path: string) => string | null
}

export class TelegramSettingsStore {
  private settings: TelegramSettingsFile
  private cachedToken: string | null | undefined
  private pairing: (TelegramPairingCode & { failedAttempts: number }) | null = null
  private readonly listeners = new Set<() => void>()
  private readonly now: () => number
  private readonly writeFile: (path: string, value: unknown) => void

  constructor(private readonly options: TelegramSettingsStoreOptions) {
    this.now = options.now ?? Date.now
    this.writeFile =
      options.writeFile ??
      ((path, value) => {
        writeSecureJsonFile(path, value)
      })
    this.settings = this.load()
  }

  private load(): TelegramSettingsFile {
    const read =
      this.options.readFile ??
      ((path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : null))
    try {
      const text = read(this.options.filePath)
      return text === null ? { ...EMPTY_SETTINGS } : parseTelegramSettingsFile(JSON.parse(text))
    } catch (error) {
      console.warn('[telegram] settings file unreadable; starting empty', error)
      return { ...EMPTY_SETTINGS }
    }
  }

  private commit(next: TelegramSettingsFile): void {
    this.writeFile(this.options.filePath, next)
    this.settings = next
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (error) {
        console.error('[telegram] settings listener threw', error)
      }
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): TelegramSettingsSnapshot {
    return {
      enabled: this.settings.enabled,
      channelsEnabled: this.settings.channelsEnabled,
      tokenConfigured: this.settings.token !== undefined,
      allowedChats: this.settings.allowedChats.map((chat) => ({ ...chat })),
      protectionGap:
        this.settings.token?.encoding === 'plaintext'
          ? (this.options.secretStore.describeProtectionGap() ??
            'The OS keychain is unavailable, so the bot token is stored unencrypted.')
          : this.settings.token
            ? this.options.secretStore.describeProtectionGap()
            : null
    }
  }

  readToken(): string | null {
    if (this.cachedToken !== undefined) {
      return this.cachedToken
    }
    const sealed = this.settings.token
    if (!sealed) {
      return (this.cachedToken = null)
    }
    try {
      const buffer = Buffer.from(sealed.payload, 'base64')
      this.cachedToken =
        sealed.encoding === 'plaintext'
          ? buffer.toString('utf8')
          : this.options.secretStore.decryptString(buffer)
    } catch (error) {
      console.error('[telegram] bot token could not be decrypted', error)
      this.cachedToken = null
    }
    return this.cachedToken
  }

  setToken(token: string): void {
    const trimmed = token.trim()
    if (!isPlausibleTelegramBotToken(trimmed)) {
      throw new Error('Telegram bot token format is invalid')
    }
    const store = this.options.secretStore
    const sealed: SealedToken = store.isEncryptionAvailable()
      ? { encoding: 'sealed', payload: store.encryptString(trimmed).toString('base64') }
      : { encoding: 'plaintext', payload: Buffer.from(trimmed, 'utf8').toString('base64') }
    if (sealed.encoding === 'plaintext') {
      console.warn('[telegram] safeStorage unavailable; storing the bot token unencrypted')
    }
    this.cachedToken = trimmed
    this.commit({ ...this.settings, token: sealed })
  }

  clearToken(): void {
    this.cachedToken = null
    const { token: _dropped, ...rest } = this.settings
    this.commit({ ...rest, enabled: false })
  }

  setEnabled(enabled: boolean): void {
    this.commit({ ...this.settings, enabled })
  }

  setChannelsEnabled(channelsEnabled: boolean): void {
    this.commit({ ...this.settings, channelsEnabled })
  }

  isChatAllowed(chatId: number): boolean {
    return this.settings.allowedChats.some((chat) => chat.chatId === chatId)
  }

  getAllowedChatIds(): number[] {
    return this.settings.allowedChats.map((chat) => chat.chatId)
  }

  removeAllowedChat(chatId: number): void {
    this.commit({
      ...this.settings,
      allowedChats: this.settings.allowedChats.filter((chat) => chat.chatId !== chatId)
    })
  }

  issuePairingCode(): TelegramPairingCode {
    this.pairing = {
      code: generatePairingCode(),
      expiresAt: this.now() + PAIRING_CODE_TTL_MS,
      failedAttempts: 0
    }
    return { code: this.pairing.code, expiresAt: this.pairing.expiresAt }
  }

  getPairingCode(): TelegramPairingCode | null {
    if (!this.pairing || this.pairing.expiresAt <= this.now()) {
      this.pairing = null
      return null
    }
    return { code: this.pairing.code, expiresAt: this.pairing.expiresAt }
  }

  /** One-time: a match allowlists the chat and burns the code; repeated misses burn it too. */
  consumePairingCode(candidate: string, chat: { chatId: number; label: string }): boolean {
    const pairing = this.getPairingCode() ? this.pairing : null
    if (!pairing) {
      return false
    }
    if (!sameCode(pairing.code, candidate)) {
      pairing.failedAttempts += 1
      if (pairing.failedAttempts >= PAIRING_MAX_FAILED_ATTEMPTS) {
        this.pairing = null
      }
      return false
    }
    this.pairing = null
    if (!this.isChatAllowed(chat.chatId)) {
      this.commit({
        ...this.settings,
        allowedChats: [
          ...this.settings.allowedChats,
          { chatId: chat.chatId, label: chat.label, pairedAt: this.now() }
        ]
      })
    }
    return true
  }
}
