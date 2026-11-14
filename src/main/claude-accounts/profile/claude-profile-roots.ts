import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getClaudeManagedAccountsRoot } from '../managed-auth-path'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'

/**
 * Config dirs of the isolated Claude account profiles on this host. Each holds its own `projects/`
 * history, which readers of `~/.claude` would otherwise never see.
 */
export function listClaudeProfileConfigDirs(): string[] {
  let root: string
  let accountIds: string[]
  try {
    root = getClaudeManagedAccountsRoot()
    accountIds = readdirSync(root)
  } catch {
    // Why: no Electron app (plain-node tests, ELECTRON_RUN_AS_NODE) or no account yet.
    return []
  }
  return accountIds
    .map((accountId) => join(root, accountId, 'config'))
    .filter((configDir) => existsSync(join(configDir, CLAUDE_PROFILE_MARKER)))
}

export function listClaudeProfileProjectsDirs(): string[] {
  return listClaudeProfileConfigDirs().map((configDir) => join(configDir, 'projects'))
}
