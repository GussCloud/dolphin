import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { getClaudePinnedConfigDir } from './managed-auth-path'

/** The CLAUDE_CONFIG_DIR a host account launches in: its linked folder or its isolated profile. */
export function getClaudeAccountConfigDir(
  account: Pick<ClaudeManagedAccount, 'id' | 'linkedConfigDir'>
): string {
  return account.linkedConfigDir || getClaudePinnedConfigDir(account.id)
}

/** Claude's own default dir runs without CLAUDE_CONFIG_DIR: setting it moves state and Keychain. */
export function isDefaultClaudeConfigDir(configDir: string, home: string = homedir()): boolean {
  return resolve(configDir) === resolve(home, '.claude')
}
