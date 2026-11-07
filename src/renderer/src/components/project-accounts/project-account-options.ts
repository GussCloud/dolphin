import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import type { ProjectRemoteTarget } from './project-account-provider'

// Why: Radix Select rejects an empty item value, so "keep today's ambient login" needs a sentinel.
export const DEFAULT_ACCOUNT_VALUE = '__default_account__'

export type ProjectAccountOption = {
  value: string
  label: string
  disabled: boolean
}

/** Null on either side means the default (ambient) account for that provider. */
export type ProjectAccountSelection =
  | { provider: 'github'; ghAccount: GhAccountBinding | null }
  | { provider: 'azure-devops'; azureDevOpsAccountId: string | null }

export function githubAccountValue(binding: GhAccountBinding): string {
  return `gh\0${binding.host.toLowerCase()}\0${binding.user.toLowerCase()}`
}

function azureAccountValue(id: string): string {
  return `ado\0${id}`
}

/** Only accounts on the remote's host; env-token logins are listed but cannot be bound. */
export function githubAccountOptions(
  inventory: GhAccountBindingInventory | null,
  host: string
): ProjectAccountOption[] {
  if (!inventory) {
    return []
  }
  const capabilityBlocks = inventory.capability !== 'supported'
  return inventory.accounts
    .filter((account) => account.host.toLowerCase() === host.toLowerCase())
    .map((account) => ({
      value: githubAccountValue(account),
      label:
        account.source === 'keyring'
          ? account.user
          : `${account.user} (${account.envToken ?? 'env'})`,
      disabled: account.source !== 'keyring' || capabilityBlocks
    }))
}

export function azureDevOpsAccountOptions(
  accounts: readonly AzureDevOpsManagedAccount[]
): ProjectAccountOption[] {
  return accounts.map((account) => ({
    value: azureAccountValue(account.id),
    label: account.login,
    disabled: false
  }))
}

export function selectionValue(selection: ProjectAccountSelection | null): string {
  if (!selection) {
    return DEFAULT_ACCOUNT_VALUE
  }
  if (selection.provider === 'github') {
    return selection.ghAccount ? githubAccountValue(selection.ghAccount) : DEFAULT_ACCOUNT_VALUE
  }
  return selection.azureDevOpsAccountId
    ? azureAccountValue(selection.azureDevOpsAccountId)
    : DEFAULT_ACCOUNT_VALUE
}

/** Maps a Select value back to a selection; null when the value is not a pickable option. */
export function selectionFromValue(
  value: string,
  target: ProjectRemoteTarget,
  context: {
    inventory: GhAccountBindingInventory | null
    azureAccounts: readonly AzureDevOpsManagedAccount[]
  }
): ProjectAccountSelection | null {
  if (target.provider === 'github') {
    if (value === DEFAULT_ACCOUNT_VALUE) {
      return { provider: 'github', ghAccount: null }
    }
    const picked = githubAccountOptions(context.inventory, target.host).find(
      (option) => option.value === value && !option.disabled
    )
    const account = picked
      ? context.inventory?.accounts.find((entry) => githubAccountValue(entry) === picked.value)
      : undefined
    return account
      ? { provider: 'github', ghAccount: { host: account.host, user: account.user } }
      : null
  }
  if (value === DEFAULT_ACCOUNT_VALUE) {
    return { provider: 'azure-devops', azureDevOpsAccountId: null }
  }
  const account = context.azureAccounts.find((entry) => azureAccountValue(entry.id) === value)
  return account ? { provider: 'azure-devops', azureDevOpsAccountId: account.id } : null
}
