import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getClaudeManagedAccountsRoot } from '../managed-auth-path'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'

let linkedConfigDirs: () => readonly string[] = () => []

/** Installed by the runtime auth service: the folders users linked as accounts. */
export function registerClaudeLinkedConfigDirs(provider: () => readonly string[]): void {
  linkedConfigDirs = provider
}

/**
 * Config dirs of the Claude account profiles on this host, isolated or linked. Each holds its own `projects/`
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
    root = ''
    accountIds = []
  }
  const isolated = accountIds
    .map((accountId) => join(root, accountId, 'config'))
    .filter((configDir) => existsSync(join(configDir, CLAUDE_PROFILE_MARKER)))
  return [...new Set([...isolated, ...linkedConfigDirs()])]
}

export function listClaudeProfileProjectsDirs(): string[] {
  return listClaudeProfileConfigDirs().map((configDir) => join(configDir, 'projects'))
}
