import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import {
  listWorktreeAgentAccountChoices,
  type WorktreeAccountAgent
} from '../../../../shared/worktree-agent-account'
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

type AgentSettings = Pick<
  GlobalSettings,
  | 'claudeManagedAccounts'
  | 'activeClaudeManagedAccountId'
  | 'activeClaudeManagedAccountIdsByRuntime'
  | 'codexManagedAccounts'
  | 'activeCodexManagedAccountId'
  | 'activeCodexManagedAccountIdsByRuntime'
>

/** Managed accounts of `agent` a local (host-runtime) project can launch with. */
export function agentStartOptions(
  agent: WorktreeAccountAgent,
  settings: AgentSettings | null | undefined
): StartAccountOption[] {
  if (!settings) {
    return []
  }
  return listWorktreeAgentAccountChoices({ agent, target: { runtime: 'host' }, settings }).map(
    (choice) => ({
      value: choice.id,
      label: choice.workspaceLabel ? `${choice.email} · ${choice.workspaceLabel}` : choice.email,
      disabled: false
    })
  )
}

/** The host-active managed account of `agent` (e.g. to restore it), or null for the system login. */
export function agentPcDefaultAccountId(
  agent: WorktreeAccountAgent,
  settings: AgentSettings | null | undefined
): string | null {
  if (!settings) {
    return null
  }
  return agent === 'codex'
    ? (settings.activeCodexManagedAccountIdsByRuntime?.host ??
        settings.activeCodexManagedAccountId ??
        null)
    : (settings.activeClaudeManagedAccountIdsByRuntime?.host ??
        settings.activeClaudeManagedAccountId ??
        null)
}

/** Email of the managed account active on this PC, or null when the system login is used. */
export function agentPcDefaultEmail(
  agent: WorktreeAccountAgent,
  settings: AgentSettings | null | undefined
): string | null {
  const activeId = agentPcDefaultAccountId(agent, settings)
  const accounts =
    agent === 'codex' ? settings?.codexManagedAccounts : settings?.claudeManagedAccounts
  return accounts?.find((account) => account.id === activeId)?.email ?? null
}
