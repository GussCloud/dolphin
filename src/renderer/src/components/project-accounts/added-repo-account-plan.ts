import type { Repo } from '../../../../shared/repo-types'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { parseWslUncPath } from '../../../../shared/wsl-paths'
import type { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { listAzureDevOpsManagedAccounts, listGhHostAccounts } from './project-account-client'
import { azureDevOpsAccountOptions, githubAccountOptions } from './project-account-options'
import {
  projectRemoteTargetFromIdentityKey,
  type ProjectRemoteTarget
} from './project-account-provider'

type RuntimeTarget = ReturnType<typeof getActiveRuntimeTarget>

export type AddedRepoAccountPlan = {
  target: ProjectRemoteTarget
  inventory: GhAccountBindingInventory | null
  azureAccounts: AzureDevOpsManagedAccount[]
  /** Inventory failure (e.g. invalid WSL distro) shown in the step instead of an empty list. */
  error: string | null
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Null means "nothing to choose", so the add finishes exactly as before: SSH projects (git runs
 * in the relay), non-git folders, rebinding an existing project, unsupported providers, or a
 * provider with no account beyond the default.
 */
export async function planAddedRepoAccountStep(
  repo: Repo,
  runtimeTarget: RuntimeTarget
): Promise<AddedRepoAccountPlan | null> {
  if (repo.connectionId || !isGitRepoKind(repo)) {
    return null
  }
  if (repo.ghAccount || repo.azureDevOpsAccountId || repo.commitIdentity) {
    return null
  }
  const identityKey = repo.gitRemoteIdentity?.canonicalKey
  const known = projectRemoteTargetFromIdentityKey(identityKey)
  if (known?.provider === 'azure-devops') {
    const azureAccounts = await listAzureDevOpsManagedAccounts(runtimeTarget).catch(() => [])
    return azureDevOpsAccountOptions(azureAccounts).length > 0
      ? { target: known, inventory: null, azureAccounts, error: null }
      : null
  }
  const wslDistro = parseWslUncPath(repo.path)?.distro
  try {
    const inventory = await listGhHostAccounts(runtimeTarget, wslDistro ? { wslDistro } : {})
    const target = projectRemoteTargetFromIdentityKey(
      identityKey,
      inventory.accounts.map((account) => account.host)
    )
    if (target?.provider !== 'github') {
      return null
    }
    const choosable = githubAccountOptions(inventory, target.host).some(
      (option) => !option.disabled
    )
    return choosable ? { target, inventory, azureAccounts: [], error: null } : null
  } catch (err) {
    // Why: a known GitHub host with a failed listing must say why, not silently skip the choice.
    return known?.provider === 'github'
      ? { target: known, inventory: null, azureAccounts: [], error: errorMessage(err) }
      : null
  }
}
