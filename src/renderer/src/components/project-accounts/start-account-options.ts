import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import {
  DEFAULT_ACCOUNT_VALUE,
  githubAccountOptions,
  githubAccountValue
} from './project-account-options'

export { DEFAULT_ACCOUNT_VALUE as PC_DEFAULT_VALUE }

export type StartAccountOption = { value: string; label: string; disabled: boolean }

/** Keyring logins on every gh host; non-github.com hosts are named so GHES logins are not confused. */
export function githubStartOptions(
  inventory: GhAccountBindingInventory | null
): StartAccountOption[] {
  const hosts = [...new Set((inventory?.accounts ?? []).map((account) => account.host))]
  return hosts.flatMap((host) =>
    githubAccountOptions(inventory, host).map((option) => ({
      ...option,
      label: host === 'github.com' ? option.label : `${option.label} · ${host}`
    }))
  )
}

export function githubBindingFromValue(
  inventory: GhAccountBindingInventory | null,
  value: string
): GhAccountBinding | null {
  const account = inventory?.accounts.find((entry) => githubAccountValue(entry) === value)
  return account ? { host: account.host, user: account.user } : null
}

/** The login gh uses today on github.com (the "PC default"), or the first host's when only GHES. */
export function githubPcDefaultLogin(inventory: GhAccountBindingInventory | null): string | null {
  const active = (inventory?.accounts ?? []).filter((account) => account.active)
  return (active.find((account) => account.host === 'github.com') ?? active[0])?.user ?? null
}

export function azureStartOptions(
  accounts: readonly AzureDevOpsManagedAccount[]
): StartAccountOption[] {
  return accounts.map((account) => ({
    value: account.id,
    // Why: a login whose `az account show` failed is saved blank; never render an empty item.
    label: account.login || account.id,
    disabled: false
  }))
}

type ClaudeSettings = Pick<
  GlobalSettings,
  | 'claudeManagedAccounts'
  | 'activeClaudeManagedAccountId'
  | 'activeClaudeManagedAccountIdsByRuntime'
>

/** Managed Claude accounts a local (host-runtime) project can launch with. */
export function claudeStartOptions(
  settings: ClaudeSettings | null | undefined
): StartAccountOption[] {
  return (settings?.claudeManagedAccounts ?? [])
    .filter((account) => account.managedAuthRuntime !== 'wsl')
    .map((account) => ({
      value: account.id,
      label: account.organizationName
        ? `${account.email} · ${account.organizationName}`
        : account.email,
      disabled: false
    }))
}

/** Email of the managed account active on this PC, or null when the system Claude login is used. */
export function claudePcDefaultEmail(settings: ClaudeSettings | null | undefined): string | null {
  if (!settings) {
    return null
  }
  const activeId =
    settings.activeClaudeManagedAccountIdsByRuntime?.host ?? settings.activeClaudeManagedAccountId
  return settings.claudeManagedAccounts.find((account) => account.id === activeId)?.email ?? null
}
