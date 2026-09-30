import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import {
  isAzureDevOpsAuthMethod,
  type AzureDevOpsAuthMethod,
  type AzureDevOpsAuthPreference
} from '../../shared/azure-devops-auth'
import { writeCredentialFileAtomic } from '../integration-credential-file'

type StoredPreference = {
  version: 1
  method: AzureDevOpsAuthMethod
  autoRenewCliSession?: boolean
}

// Why 'token' default: profiles from before the Azure CLI option keep their env-var behavior.
const DEFAULT_PREFERENCE: AzureDevOpsAuthPreference = {
  method: 'token',
  autoRenewCliSession: false
}

let cached: AzureDevOpsAuthPreference | null = null

function preferencePath(): string {
  return join(homedir(), FORK_HOME_STATE_DIR_NAME, 'azure-devops-auth.json')
}

function readFromDisk(): AzureDevOpsAuthPreference {
  const path = preferencePath()
  if (!existsSync(path)) {
    return DEFAULT_PREFERENCE
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (parsed && typeof parsed === 'object' && 'method' in parsed) {
      const { method } = parsed
      const autoRenew = 'autoRenewCliSession' in parsed ? parsed.autoRenewCliSession : false
      if (isAzureDevOpsAuthMethod(method)) {
        return { method, autoRenewCliSession: autoRenew === true }
      }
    }
  } catch (error) {
    console.warn('[azure-devops] ignoring unreadable auth preference', error)
  }
  return DEFAULT_PREFERENCE
}

export function getAzureDevOpsAuthPreference(): AzureDevOpsAuthPreference {
  cached ??= readFromDisk()
  return cached
}

export function setAzureDevOpsAuthPreference(
  update: Partial<AzureDevOpsAuthPreference>
): AzureDevOpsAuthPreference {
  const next = { ...getAzureDevOpsAuthPreference(), ...update }
  const dir = join(homedir(), FORK_HOME_STATE_DIR_NAME)
  mkdirSync(dir, { recursive: true })
  const stored: StoredPreference = { version: 1, ...next }
  writeCredentialFileAtomic(preferencePath(), Buffer.from(JSON.stringify(stored), 'utf-8'))
  cached = next
  return cached
}

/** @internal - tests need a clean preference cache between cases. */
export function _resetAzureDevOpsAuthPreferenceCache(): void {
  cached = null
}
