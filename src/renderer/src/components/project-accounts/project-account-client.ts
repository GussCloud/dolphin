import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import type { AzureCliSignInMode } from '../../../../shared/azure-devops-auth'
import { callRuntimeRpc, type getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeTarget = ReturnType<typeof getActiveRuntimeTarget>

const ACCOUNT_CALL_TIMEOUT_MS = 30_000

/** Every gh login on the execution host, optionally narrowed to one host; used before a repo exists. */
export function listGhHostAccounts(
  runtimeTarget: RuntimeTarget,
  args: { host?: string; refreshCapability?: boolean; wslDistro?: string } = {}
): Promise<GhAccountBindingInventory> {
  if (runtimeTarget.kind === 'environment') {
    return callRuntimeRpc<GhAccountBindingInventory>(
      runtimeTarget,
      'github.listHostAccounts',
      args,
      {
        timeoutMs: ACCOUNT_CALL_TIMEOUT_MS
      }
    )
  }
  return window.api.gh.listHostAccounts(args)
}

/** Managed Azure DevOps accounts live on this desktop only (their sign-in opens a local window). */
export function managedAzureDevOpsAccountsSupported(runtimeTarget: RuntimeTarget): boolean {
  return runtimeTarget.kind !== 'environment'
}

export function listAzureDevOpsManagedAccounts(
  runtimeTarget: RuntimeTarget
): Promise<AzureDevOpsManagedAccount[]> {
  if (!managedAzureDevOpsAccountsSupported(runtimeTarget)) {
    return Promise.resolve([])
  }
  return window.api.azureDevOps.listManagedAccounts()
}

export type AzureDevOpsAddAccountResult =
  | { ok: true; account: AzureDevOpsManagedAccount }
  | { ok: false; error: string }

/** Runs an interactive `az login` into a fresh isolated config dir; cancel with cancelCliSignIn. */
export function addAzureDevOpsManagedAccount(
  mode: AzureCliSignInMode = 'in-app'
): Promise<AzureDevOpsAddAccountResult> {
  return window.api.azureDevOps.addManagedAccount(mode)
}

export async function removeAzureDevOpsManagedAccount(id: string): Promise<void> {
  const result = await window.api.azureDevOps.removeManagedAccount(id)
  if (!result.ok) {
    throw new Error(result.error)
  }
}

/**
 * Why a binding is not applied in this project's terminals. Desktop-only: a remote runtime or
 * an older host without the call reports nothing rather than a guess.
 */
export async function listTerminalGitAccountWarnings(
  runtimeTarget: RuntimeTarget,
  repoId: string
): Promise<string[]> {
  const read = window.api.repos.getTerminalGitAccountWarnings
  if (runtimeTarget.kind === 'environment' || !read) {
    return []
  }
  try {
    const warnings = await read({ repoId })
    return Array.isArray(warnings) ? warnings.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}
