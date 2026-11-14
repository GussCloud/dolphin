import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type {
  ClaudeConfigFolderDiscovery,
  ClaudeManagedAccount
} from '../../shared/managed-account-types'
import type { GlobalSettings } from '../../shared/global-settings-types'
import {
  describeClaudeConfigFolder,
  discoverClaudeShellSelector,
  isLinkableClaudeConfigDir
} from './profile/claude-shell-selector-discovery'

function linkedAccountFor(
  accounts: readonly ClaudeManagedAccount[],
  configDir: string
): ClaudeManagedAccount | undefined {
  return accounts.find(
    (account) => account.linkedConfigDir && resolve(account.linkedConfigDir) === resolve(configDir)
  )
}

/** Folders the user's terminal menu uses, each marked with the account already linked to it. */
export function discoverClaudeConfigFolders(
  settings: Pick<GlobalSettings, 'claudeManagedAccounts'>,
  home: string = homedir()
): ClaudeConfigFolderDiscovery {
  const discovery = discoverClaudeShellSelector(home)
  return {
    selectorFile: discovery.selectorFile,
    folders: discovery.folders.map((folder) => ({
      ...folder,
      linkedAccountId:
        linkedAccountFor(settings.claudeManagedAccounts, folder.configDir)?.id ?? null
    }))
  }
}

/**
 * The account a linked folder becomes. Only what the CLI already wrote there is read: the
 * identity of its last login. Credentials stay where the CLI keeps them.
 */
export function createLinkedClaudeAccount(
  settings: Pick<GlobalSettings, 'claudeManagedAccounts'>,
  configDir: string,
  home: string = homedir(),
  now: number = Date.now()
): ClaudeManagedAccount {
  const resolved = resolve(configDir)
  if (!isLinkableClaudeConfigDir(resolved, home)) {
    throw new Error(
      `${resolved} is not a Claude config folder. Pick the folder that holds .claude.json, settings.json or projects.`
    )
  }
  if (linkedAccountFor(settings.claudeManagedAccounts, resolved)) {
    throw new Error(`${resolved} is already linked to a Claude account.`)
  }
  const folder = describeClaudeConfigFolder(resolved, home)
  if (!folder.email) {
    throw new Error(
      `No Claude login was found in ${resolved}. Sign in once from your terminal with that folder, then link it again.`
    )
  }
  return {
    id: randomUUID(),
    email: folder.email,
    // Why the folder itself: every managed-store path refuses a dir outside Dolphin's own, so
    // nothing written for managed accounts can ever land in the user's folder.
    managedAuthPath: resolved,
    managedAuthRuntime: 'host',
    linkedConfigDir: resolved,
    authMethod: 'subscription-oauth',
    organizationUuid: folder.organizationUuid,
    organizationName: folder.organizationName,
    createdAt: now,
    updatedAt: now,
    lastAuthenticatedAt: now
  }
}
