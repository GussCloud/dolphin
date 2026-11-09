import type { BrowserWindow } from 'electron'
import type { AzureCliSignInMode } from '../../shared/azure-devops-auth'
import type { AzureDevOpsManagedAccount } from '../../shared/source-control-account-types'
import type { Repo } from '../../shared/repo-types'
import { getRepoExecutionHostId } from '../../shared/execution-host'
import { runAzureCliJson } from './azure-cli-runner'
import { runAzureCliManagedSignIn } from './azure-cli-interactive-sign-in'
import {
  createPendingAzureDevOpsAccountDir,
  deleteAzureDevOpsManagedAccount,
  discardAzureDevOpsAccountDir,
  saveAzureDevOpsManagedAccount
} from './azure-devops-managed-accounts'

export type AzureDevOpsManagedAccountStore = {
  getRepos: () => Repo[]
  getAllWorktreeMeta?: () => Record<string, unknown>
  updateRepo: (
    id: string,
    updates: { azureDevOpsAccountId: null },
    hostId?: ReturnType<typeof getRepoExecutionHostId>
  ) => Repo | null
}

export type AddAzureDevOpsManagedAccountResult =
  | { ok: true; account: AzureDevOpsManagedAccount }
  | { ok: false; error: string }

async function readSignedInLogin(configDir: string): Promise<string> {
  try {
    const raw = await runAzureCliJson(['account', 'show'], { configDir })
    const user = raw && typeof raw === 'object' && 'user' in raw ? raw.user : null
    const name = user && typeof user === 'object' && 'name' in user ? user.name : null
    return typeof name === 'string' ? name.trim() : ''
  } catch {
    return ''
  }
}

/** Runs `az login` into a fresh isolated config dir; records the account only when it succeeds. */
export async function addAzureDevOpsManagedAccount(
  mode: AzureCliSignInMode,
  options: { parent?: BrowserWindow | null } = {}
): Promise<AddAzureDevOpsManagedAccountResult> {
  const pending = createPendingAzureDevOpsAccountDir()
  try {
    const result = await runAzureCliManagedSignIn(mode, pending.configDir, options)
    if (!result.ok) {
      discardAzureDevOpsAccountDir(pending.configDirName)
      return result
    }
    const login = await readSignedInLogin(pending.configDir)
    return {
      ok: true,
      account: saveAzureDevOpsManagedAccount({ login, configDirName: pending.configDirName })
    }
  } catch (error) {
    discardAzureDevOpsAccountDir(pending.configDirName)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Deletes the account and unbinds every project that used it; returns how many were unbound. */
export function removeAzureDevOpsManagedAccount(
  store: AzureDevOpsManagedAccountStore,
  id: string
): { ok: true; unboundRepoIds: string[] } | { ok: false; error: string } {
  if (!deleteAzureDevOpsManagedAccount(id)) {
    return { ok: false, error: 'Azure DevOps account not found.' }
  }
  const unboundRepoIds: string[] = []
  for (const repo of store.getRepos()) {
    if (repo.azureDevOpsAccountId === id) {
      store.updateRepo(repo.id, { azureDevOpsAccountId: null }, getRepoExecutionHostId(repo))
      unboundRepoIds.push(repo.id)
    }
  }
  return { ok: true, unboundRepoIds }
}
