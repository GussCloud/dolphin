import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import { getSecretStore } from '../../shared/secret-store'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createEncryptedApiKeyFile } from '../secrets/encrypted-api-key-file'

export const DEEPSEEK_SECURE_STORAGE_UNAVAILABLE_MESSAGE =
  "Secure storage is unavailable on this system, so Dolphin can't save the DeepSeek key."

// Same envelope shape as the MiniMax API key store, under its own file and prefix, but encrypted only.
const deepSeekApiKeyFile = createEncryptedApiKeyFile({
  path: () => join(homedir(), FORK_HOME_STATE_DIR_NAME, 'deepseek-api-key.enc'),
  envelopePrefix: 'dolphin-deepseek-api-key:v1:',
  logTag: 'deepseek',
  requiredMessage: 'DeepSeek API key is required',
  unavailableMessage: DEEPSEEK_SECURE_STORAGE_UNAVAILABLE_MESSAGE,
  decryptErrorMessage: 'DeepSeek API key could not be decrypted'
})

export function isDeepSeekKeyEncryptionAvailable(): boolean {
  return getSecretStore().isEncryptionAvailable()
}

export function hasDeepSeekApiKey(): boolean {
  return deepSeekApiKeyFile.has()
}

export function saveDeepSeekApiKey(key: string): void {
  deepSeekApiKeyFile.save(key)
}

/** Returns null when no key is saved; throws when a saved key cannot be decrypted. */
export function readDeepSeekApiKey(): string | null {
  return deepSeekApiKeyFile.read()
}

export function clearDeepSeekApiKey(): void {
  deepSeekApiKeyFile.clear()
}
