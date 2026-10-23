import { ipcMain, net } from 'electron'
import type {
  DeepSeekCredentialsStatus,
  DeepSeekListModelsResult
} from '../../shared/deepseek-claude-provider'
import {
  clearDeepSeekApiKey,
  hasDeepSeekApiKey,
  isDeepSeekKeyEncryptionAvailable,
  readDeepSeekApiKey,
  saveDeepSeekApiKey
} from '../deepseek/deepseek-api-key-store'
import { requestDeepSeekModels } from '../deepseek/deepseek-models-request'

function getDeepSeekCredentialsStatus(): DeepSeekCredentialsStatus {
  return {
    apiKeyConfigured: hasDeepSeekApiKey(),
    encryptionAvailable: isDeepSeekKeyEncryptionAvailable()
  }
}

async function listDeepSeekModels(): Promise<DeepSeekListModelsResult> {
  let apiKey: string | null
  try {
    apiKey = readDeepSeekApiKey()
  } catch {
    // An undecryptable key is as unusable as a missing one; the user re-saves it.
    apiKey = null
  }
  if (!apiKey) {
    return { ok: false, reason: 'no-api-key' }
  }
  return requestDeepSeekModels(apiKey, (url, init) => net.fetch(url, init))
}

export function registerDeepSeekCredentialsHandlers(): void {
  ipcMain.handle('deepseekCredentials:getStatus', () => getDeepSeekCredentialsStatus())
  ipcMain.handle('deepseekCredentials:saveApiKey', (_event, key: unknown) => {
    if (typeof key !== 'string') {
      throw new Error('DeepSeek API key must be a string')
    }
    saveDeepSeekApiKey(key)
    return getDeepSeekCredentialsStatus()
  })
  ipcMain.handle('deepseekCredentials:clearApiKey', () => {
    clearDeepSeekApiKey()
    return getDeepSeekCredentialsStatus()
  })
  ipcMain.handle('deepseekCredentials:listModels', () => listDeepSeekModels())
}
