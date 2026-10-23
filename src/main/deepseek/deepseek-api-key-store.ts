import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import { safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { hardenExistingSecureFile, writeSecureFile } from '../../shared/secure-file'

// Same envelope shape as the MiniMax API key store, under its own file and prefix, but encrypted only.
const DEEPSEEK_API_KEY_FILE = 'deepseek-api-key.enc'
const API_KEY_ENVELOPE_PREFIX = 'dolphin-deepseek-api-key:v1:'
export const DEEPSEEK_SECURE_STORAGE_UNAVAILABLE_MESSAGE =
  "Secure storage is unavailable on this system, so Dolphin can't save the DeepSeek key."
const DECRYPT_ERROR_MESSAGE = 'DeepSeek API key could not be decrypted'
let cachedDeepSeekApiKey: string | null = null

type DeepSeekApiKeyEnvelope = {
  kind: 'encrypted' | 'plaintext'
  payload: Buffer
}

function getDeepSeekApiKeyPath(): string {
  return join(homedir(), FORK_HOME_STATE_DIR_NAME, DEEPSEEK_API_KEY_FILE)
}

function encodeApiKeyEnvelope(kind: DeepSeekApiKeyEnvelope['kind'], payload: Buffer): string {
  return `${API_KEY_ENVELOPE_PREFIX}${kind}:${payload.toString('base64')}`
}

function decodeApiKeyEnvelope(raw: Buffer): DeepSeekApiKeyEnvelope {
  const text = raw.toString('utf8')
  if (!text.startsWith(API_KEY_ENVELOPE_PREFIX)) {
    throw new Error(DECRYPT_ERROR_MESSAGE)
  }
  const rest = text.slice(API_KEY_ENVELOPE_PREFIX.length)
  const separator = rest.indexOf(':')
  if (separator === -1) {
    throw new Error(DECRYPT_ERROR_MESSAGE)
  }
  const kind = rest.slice(0, separator)
  if (kind !== 'encrypted' && kind !== 'plaintext') {
    throw new Error(DECRYPT_ERROR_MESSAGE)
  }
  return { kind, payload: Buffer.from(rest.slice(separator + 1), 'base64') }
}

function readEnvelope(envelope: DeepSeekApiKeyEnvelope): string {
  // Why: the key may only ever live encrypted; a plaintext envelope is never trusted.
  if (envelope.kind !== 'encrypted' || !safeStorage.isEncryptionAvailable()) {
    throw new Error(DECRYPT_ERROR_MESSAGE)
  }
  return safeStorage.decryptString(envelope.payload)
}

function hardenKeyFile(keyPath: string): void {
  try {
    hardenExistingSecureFile(keyPath)
  } catch (error) {
    console.warn('[deepseek] Failed to harden DeepSeek API key file', error)
  }
}

export function isDeepSeekKeyEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function hasDeepSeekApiKey(): boolean {
  const keyPath = getDeepSeekApiKeyPath()
  if (!existsSync(keyPath)) {
    return false
  }
  hardenKeyFile(keyPath)
  return true
}

export function saveDeepSeekApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    throw new Error('DeepSeek API key is required')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(DEEPSEEK_SECURE_STORAGE_UNAVAILABLE_MESSAGE)
  }
  writeSecureFile(
    getDeepSeekApiKeyPath(),
    encodeApiKeyEnvelope('encrypted', safeStorage.encryptString(trimmed))
  )
  cachedDeepSeekApiKey = trimmed
}

/** Returns null when no key is saved; throws when a saved key cannot be decrypted. */
export function readDeepSeekApiKey(): string | null {
  if (cachedDeepSeekApiKey !== null) {
    return cachedDeepSeekApiKey
  }
  const keyPath = getDeepSeekApiKeyPath()
  if (!existsSync(keyPath)) {
    return null
  }
  hardenKeyFile(keyPath)
  try {
    cachedDeepSeekApiKey = readEnvelope(decodeApiKeyEnvelope(readFileSync(keyPath)))
    return cachedDeepSeekApiKey
  } catch (error) {
    console.error('[deepseek] failed to decode/decrypt API key', error)
    throw new Error(DECRYPT_ERROR_MESSAGE)
  }
}

export function clearDeepSeekApiKey(): void {
  cachedDeepSeekApiKey = null
  rmSync(getDeepSeekApiKeyPath(), { force: true })
}
