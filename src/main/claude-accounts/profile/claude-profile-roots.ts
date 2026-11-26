import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { CLAUDE_PROFILE_MARKER } from '../pinned-config-dir/claude-pinned-config-layout'

type ClaudeProfileRootSources = {
  /** `<userData>/claude-accounts`; null before the auth service runs here. */
  managedAccountsRoot: () => string | null
  /** Folders users linked as accounts, other than `~/.claude`. */
  linkedConfigDirs: () => readonly string[]
  /** Ids of the accounts billed to an API key; their isolated profiles belong to `claude-api`. */
  apiKeyAccountIds: () => readonly string[]
}

let sources: ClaudeProfileRootSources = {
  managedAccountsRoot: () => null,
  linkedConfigDirs: () => [],
  apiKeyAccountIds: () => []
}

/** Installed by the runtime auth service; kept as a port so plain-Node runtimes need no Electron. */
export function registerClaudeProfileRootSources(next: ClaudeProfileRootSources): void {
  sources = next
}

function listIsolatedProfileConfigDirs(): { configDir: string; accountId: string }[] {
  const root = sources.managedAccountsRoot()
  if (!root) {
    return []
  }
  let accountIds: string[]
  try {
    accountIds = readdirSync(root)
  } catch {
    return []
  }
  return accountIds
    .map((accountId) => ({ accountId, configDir: join(root, accountId, 'config') }))
    .filter(({ configDir }) => existsSync(join(configDir, CLAUDE_PROFILE_MARKER)))
}

/**
 * Config dirs of every Claude account profile on this host, isolated or linked, API accounts
 * included. Each holds its own `projects/` history, which readers of `~/.claude` would otherwise
 * never see. Readers that attribute a session to an agent use the plan/API split below instead.
 */
export function listClaudeProfileConfigDirs(): string[] {
  return [
    ...new Set([
      ...listIsolatedProfileConfigDirs().map(({ configDir }) => configDir),
      ...sources.linkedConfigDirs()
    ])
  ]
}

/** Profiles plain `claude` runs in (subscription logins): every profile but the API accounts'. */
export function listClaudePlanProfileConfigDirs(): string[] {
  const apiIds = new Set(sources.apiKeyAccountIds())
  return [
    ...new Set([
      ...listIsolatedProfileConfigDirs()
        .filter(({ accountId }) => !apiIds.has(accountId))
        .map(({ configDir }) => configDir),
      ...sources.linkedConfigDirs()
    ])
  ]
}

/** Profiles of the accounts billed to an API key, where every `claude-api` session lives. */
export function listClaudeApiProfileConfigDirs(): string[] {
  const apiIds = new Set(sources.apiKeyAccountIds())
  return listIsolatedProfileConfigDirs()
    .filter(({ accountId }) => apiIds.has(accountId))
    .map(({ configDir }) => configDir)
}

export function listClaudeProfileProjectsDirs(): string[] {
  return listClaudeProfileConfigDirs().map((configDir) => join(configDir, 'projects'))
}

export function listClaudePlanProfileProjectsDirs(): string[] {
  return listClaudePlanProfileConfigDirs().map((configDir) => join(configDir, 'projects'))
}

export function listClaudeApiProfileProjectsDirs(): string[] {
  return listClaudeApiProfileConfigDirs().map((configDir) => join(configDir, 'projects'))
}

function isPathInside(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Whether a host path (a hook's transcript) sits under an API account's profile. Decided from this
 * host's account list, so a path alone never claims the API identity for a dir that is not one.
 */
export function isClaudeApiProfilePath(path: string | null | undefined): boolean {
  if (!path || !isAbsolute(path)) {
    return false
  }
  const root = sources.managedAccountsRoot()
  if (!root) {
    return false
  }
  const normalize = (value: string): string =>
    process.platform === 'win32' ? value.toLowerCase() : value
  const candidate = normalize(path)
  return sources
    .apiKeyAccountIds()
    .some((accountId) => isPathInside(candidate, normalize(join(root, accountId, 'config'))))
}
