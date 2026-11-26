import { homedir } from 'node:os'
import { join } from 'node:path'
import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import type { ClaudeApiKeyStatus } from '../../shared/managed-account-types'
import { getSecretStore } from '../../shared/secret-store'
import {
  createEncryptedApiKeyFile,
  type EncryptedApiKeyFile
} from '../secrets/encrypted-api-key-file'

export const CLAUDE_API_KEY_SECURE_STORAGE_UNAVAILABLE_MESSAGE =
  "Secure storage is unavailable on this system, so Dolphin can't save the Anthropic API key."

// Why: the id names a file; anything but a plain id could escape the key folder.
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

function claudeApiKeyFile(accountId: string): EncryptedApiKeyFile {
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error('Invalid Claude account id.')
  }
  return createEncryptedApiKeyFile({
    path: () => join(homedir(), FORK_HOME_STATE_DIR_NAME, 'claude-api-keys', `${accountId}.enc`),
    envelopePrefix: 'dolphin-claude-api-key:v1:',
    logTag: 'claude-api-key',
    requiredMessage: 'Anthropic API key is required',
    unavailableMessage: CLAUDE_API_KEY_SECURE_STORAGE_UNAVAILABLE_MESSAGE,
    decryptErrorMessage: 'Anthropic API key could not be decrypted'
  })
}

export function isClaudeApiKeyEncryptionAvailable(): boolean {
  return getSecretStore().isEncryptionAvailable()
}

export function getClaudeApiKeyStatus(accountId: string): ClaudeApiKeyStatus {
  return {
    apiKeyConfigured: claudeApiKeyFile(accountId).has(),
    encryptionAvailable: isClaudeApiKeyEncryptionAvailable()
  }
}

export function saveClaudeApiKey(accountId: string, key: string): void {
  claudeApiKeyFile(accountId).save(key)
}

/** Null when no key is saved; throws when a saved key cannot be decrypted. */
export function readClaudeApiKey(accountId: string): string | null {
  return claudeApiKeyFile(accountId).read()
}

export function clearClaudeApiKey(accountId: string): void {
  claudeApiKeyFile(accountId).clear()
}
