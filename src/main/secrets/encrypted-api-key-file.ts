import { existsSync, readFileSync, rmSync } from 'node:fs'
import { getSecretStore } from '../../shared/secret-store'
import { hardenExistingSecureFile, writeSecureFile } from '../../shared/secure-file'

export type EncryptedApiKeyFileOptions = {
  /** Resolved on each call so a test or a moved home never reads a stale path. */
  path: () => string
  /** Envelope prefix; a file written by another store under another prefix is never read. */
  envelopePrefix: string
  logTag: string
  requiredMessage: string
  unavailableMessage: string
  decryptErrorMessage: string
}

export type EncryptedApiKeyFile = {
  has(): boolean
  save(key: string): void
  /** Null when no key is saved; throws when a saved key cannot be decrypted. */
  read(): string | null
  clear(): void
}

type Envelope = { kind: string; payload: Buffer }

/** An API key that only ever lives safeStorage-encrypted on disk; plaintext is never written or read. */
export function createEncryptedApiKeyFile(
  options: EncryptedApiKeyFileOptions
): EncryptedApiKeyFile {
  let cached: string | null = null

  const decode = (raw: Buffer): Envelope => {
    const text = raw.toString('utf8')
    if (!text.startsWith(options.envelopePrefix)) {
      throw new Error(options.decryptErrorMessage)
    }
    const rest = text.slice(options.envelopePrefix.length)
    const separator = rest.indexOf(':')
    if (separator === -1) {
      throw new Error(options.decryptErrorMessage)
    }
    return {
      kind: rest.slice(0, separator),
      payload: Buffer.from(rest.slice(separator + 1), 'base64')
    }
  }

  const harden = (keyPath: string): void => {
    try {
      hardenExistingSecureFile(keyPath)
    } catch (error) {
      console.warn(`[${options.logTag}] Failed to harden API key file`, error)
    }
  }

  return {
    has() {
      const keyPath = options.path()
      if (!existsSync(keyPath)) {
        return false
      }
      harden(keyPath)
      return true
    },
    save(key) {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new Error(options.requiredMessage)
      }
      if (!getSecretStore().isEncryptionAvailable()) {
        throw new Error(options.unavailableMessage)
      }
      const payload = getSecretStore().encryptString(trimmed)
      writeSecureFile(
        options.path(),
        `${options.envelopePrefix}encrypted:${payload.toString('base64')}`
      )
      cached = trimmed
    },
    read() {
      if (cached !== null) {
        return cached
      }
      const keyPath = options.path()
      if (!existsSync(keyPath)) {
        return null
      }
      harden(keyPath)
      try {
        const envelope = decode(readFileSync(keyPath))
        // Why: the key may only ever live encrypted; a plaintext envelope is never trusted.
        if (envelope.kind !== 'encrypted' || !getSecretStore().isEncryptionAvailable()) {
          throw new Error(options.decryptErrorMessage)
        }
        cached = getSecretStore().decryptString(envelope.payload)
        return cached
      } catch (error) {
        console.error(`[${options.logTag}] failed to decode/decrypt API key`, error)
        throw new Error(options.decryptErrorMessage)
      }
    },
    clear() {
      cached = null
      rmSync(options.path(), { force: true })
    }
  }
}
