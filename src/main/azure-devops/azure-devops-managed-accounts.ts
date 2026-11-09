/**
 * Dolphin-managed Azure DevOps accounts: one isolated Azure CLI config dir per account
 * (`AZURE_CONFIG_DIR`), so several company logins coexist without touching the user's own
 * `az login`. The record file lists ids/logins only; tokens stay inside each config dir.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getAppEnvironment } from '../../shared/app-environment'
import {
  normalizeAzureDevOpsAccountId,
  normalizeAzureDevOpsManagedAccounts,
  type AzureDevOpsManagedAccount
} from '../../shared/source-control-account-types'
import { writeCredentialFileAtomic } from '../integration-credential-file'
import { clearManagedAzureCliAccessTokenCache } from './azure-cli-access-token'

const ACCOUNTS_DIR_NAME = 'azure-devops-accounts'
const RECORD_FILE_NAME = 'accounts.json'

let rootOverrideForTests: string | null = null
let cached: AzureDevOpsManagedAccount[] | null = null

function accountsRoot(): string {
  return rootOverrideForTests ?? join(getAppEnvironment().getPath('userData'), ACCOUNTS_DIR_NAME)
}

function recordPath(): string {
  return join(accountsRoot(), RECORD_FILE_NAME)
}

function readFromDisk(): AzureDevOpsManagedAccount[] {
  const path = recordPath()
  if (!existsSync(path)) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    const accounts =
      parsed && typeof parsed === 'object' && 'accounts' in parsed ? parsed.accounts : []
    return normalizeAzureDevOpsManagedAccounts(accounts)
  } catch (error) {
    console.warn('[azure-devops] ignoring unreadable managed accounts file', error)
    return []
  }
}

function writeToDisk(accounts: AzureDevOpsManagedAccount[]): void {
  mkdirSync(accountsRoot(), { recursive: true })
  writeCredentialFileAtomic(
    recordPath(),
    Buffer.from(JSON.stringify({ version: 1, accounts }, null, 2), 'utf-8')
  )
  cached = accounts
}

export function listAzureDevOpsManagedAccounts(): AzureDevOpsManagedAccount[] {
  cached ??= readFromDisk()
  return [...cached]
}

export function findAzureDevOpsManagedAccount(id: string): AzureDevOpsManagedAccount | null {
  const normalized = normalizeAzureDevOpsAccountId(id)
  if (!normalized) {
    return null
  }
  return listAzureDevOpsManagedAccounts().find((account) => account.id === normalized) ?? null
}

export function azureDevOpsAccountConfigDir(
  account: Pick<AzureDevOpsManagedAccount, 'configDirName'>
): string {
  return join(accountsRoot(), account.configDirName)
}

/** Reserves a fresh, empty config dir for a sign-in that has not finished yet. */
export function createPendingAzureDevOpsAccountDir(): { configDirName: string; configDir: string } {
  const configDirName = randomUUID().replace(/-/g, '')
  const configDir = join(accountsRoot(), configDirName)
  mkdirSync(configDir, { recursive: true })
  return { configDirName, configDir }
}

export function discardAzureDevOpsAccountDir(configDirName: string): void {
  const safe = normalizeAzureDevOpsAccountId(configDirName)
  if (safe) {
    rmSync(join(accountsRoot(), safe), { recursive: true, force: true })
  }
}

export function saveAzureDevOpsManagedAccount(input: {
  login: string
  configDirName: string
}): AzureDevOpsManagedAccount {
  const account: AzureDevOpsManagedAccount = {
    id: randomUUID().replace(/-/g, ''),
    login: input.login,
    configDirName: input.configDirName,
    createdAt: Date.now()
  }
  writeToDisk([...listAzureDevOpsManagedAccounts(), account])
  return account
}

/** Deletes the record and its config dir (the sign-in). Returns false when the id is unknown. */
export function deleteAzureDevOpsManagedAccount(id: string): boolean {
  const account = findAzureDevOpsManagedAccount(id)
  if (!account) {
    return false
  }
  writeToDisk(listAzureDevOpsManagedAccounts().filter((entry) => entry.id !== account.id))
  clearManagedAzureCliAccessTokenCache(azureDevOpsAccountConfigDir(account))
  discardAzureDevOpsAccountDir(account.configDirName)
  return true
}

/** @internal - tests point the store at a temp dir. */
export function _setAzureDevOpsManagedAccountsRootForTests(root: string | null): void {
  rootOverrideForTests = root
  cached = null
}
