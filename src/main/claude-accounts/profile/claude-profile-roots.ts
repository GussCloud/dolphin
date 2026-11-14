import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'

type ClaudeProfileRootSources = {
  /** `<userData>/claude-accounts`; null before the auth service runs here. */
  managedAccountsRoot: () => string | null
  /** Folders users linked as accounts, other than `~/.claude`. */
  linkedConfigDirs: () => readonly string[]
}

let sources: ClaudeProfileRootSources = {
  managedAccountsRoot: () => null,
  linkedConfigDirs: () => []
}

/** Installed by the runtime auth service; kept as a port so plain-Node runtimes need no Electron. */
export function registerClaudeProfileRootSources(next: ClaudeProfileRootSources): void {
  sources = next
}

/**
 * Config dirs of the Claude account profiles on this host, isolated or linked. Each holds its own
 * `projects/` history, which readers of `~/.claude` would otherwise never see.
 */
export function listClaudeProfileConfigDirs(): string[] {
  const root = sources.managedAccountsRoot()
  let accountIds: string[] = []
  if (root) {
    try {
      accountIds = readdirSync(root)
    } catch {
      accountIds = []
    }
  }
  const isolated = accountIds
    .map((accountId) => join(root ?? '', accountId, 'config'))
    .filter((configDir) => existsSync(join(configDir, CLAUDE_PROFILE_MARKER)))
  return [...new Set([...isolated, ...sources.linkedConfigDirs()])]
}

export function listClaudeProfileProjectsDirs(): string[] {
  return listClaudeProfileConfigDirs().map((configDir) => join(configDir, 'projects'))
}
