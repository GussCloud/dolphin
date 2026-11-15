import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import {
  readActiveClaudeKeychainCredentialsStrict,
  writeActiveClaudeKeychainCredentials,
  writeClaudeKeychainCredentialsForConfigDir
} from '../claude-accounts/keychain'
import { hasLiveClaudePtys } from '../claude-accounts/live-pty-gate'
import {
  isOauthTokenExpiring,
  refreshClaudeOauthCredentials
} from '../claude-accounts/oauth-refresh'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { parseClaudeOAuthCredentialsJson } from './claude-oauth-credentials'
import { fetchClaudeOAuthUsage } from './claude-oauth-usage-request'
import type { ClaudeManagedAccountUsageOptions } from './claude-usage-fetch-options'
import { abortedClaudeRateLimitResult } from './claude-usage-result'

type LinkedFolderUsageDeps = {
  platform?: NodeJS.Platform
  home?: string
  readKeychain?: (configDir?: string) => Promise<string | null>
  readFile?: (path: string) => string | null
  fetchUsage?: typeof fetchClaudeOAuthUsage
  refresh?: (credentialsJson: string) => Promise<string | null>
  writeKeychain?: (contents: string, configDir?: string) => Promise<void>
  writeFile?: (path: string, contents: string) => void
  hasLivePtys?: () => boolean
}

function errorResult(error: string): ProviderRateLimits {
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error,
    status: 'error'
  }
}

function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

/** The login the CLI keeps for `configDir`, where the CLI itself keeps it. Read-only. */
function keychainDir(configDir: string, deps: LinkedFolderUsageDeps): string | undefined {
  // Why: the default dir's Keychain item is the unsuffixed one; any other dir's is keyed by path.
  return resolve(configDir) === resolve(deps.home ?? homedir(), '.claude') ? undefined : configDir
}

async function readLinkedFolderCredentials(
  configDir: string,
  deps: LinkedFolderUsageDeps
): Promise<string | null> {
  if ((deps.platform ?? process.platform) === 'darwin') {
    return (deps.readKeychain ?? readActiveClaudeKeychainCredentialsStrict)(
      keychainDir(configDir, deps)
    ).catch(() => null)
  }
  return (deps.readFile ?? readFileOrNull)(join(configDir, '.credentials.json'))
}

/** Puts a renewed login back exactly where the CLI keeps this folder's, so its terminal keeps it. */
async function writeLinkedFolderCredentials(
  configDir: string,
  credentialsJson: string,
  deps: LinkedFolderUsageDeps
): Promise<void> {
  if ((deps.platform ?? process.platform) === 'darwin') {
    const dir = keychainDir(configDir, deps)
    await (
      deps.writeKeychain ??
      ((contents: string, target?: string) =>
        target
          ? writeClaudeKeychainCredentialsForConfigDir(contents, target)
          : writeActiveClaudeKeychainCredentials(contents))
    )(credentialsJson, dir)
    return
  }
  ;(
    deps.writeFile ??
    ((path: string, contents: string) => writeFileAtomically(path, contents, { mode: 0o600 }))
  )(join(configDir, '.credentials.json'), credentialsJson)
}

/**
 * Usage of an account whose folder the user manages (a linked folder). An expiring login is
 * renewed and written back where the CLI keeps it, because the refresh token is single-use: a
 * renewal kept only by Dolphin would log the user's terminal out. Skipped while a Claude
 * terminal runs in Dolphin, which may be renewing the same login itself.
 */
export async function fetchLinkedFolderClaudeUsage(
  configDir: string,
  options: ClaudeManagedAccountUsageOptions = {},
  deps: LinkedFolderUsageDeps = {}
): Promise<ProviderRateLimits> {
  if (options.signal?.aborted) {
    return abortedClaudeRateLimitResult()
  }
  let credentialsJson = await readLinkedFolderCredentials(configDir, deps)
  if (!credentialsJson) {
    return errorResult('No credentials')
  }
  if (isOauthTokenExpiring(credentialsJson)) {
    const renewed = (deps.hasLivePtys ?? hasLiveClaudePtys)()
      ? null
      : await (deps.refresh ?? refreshClaudeOauthCredentials)(credentialsJson)
    if (options.signal?.aborted) {
      return abortedClaudeRateLimitResult()
    }
    if (!renewed) {
      return errorResult(
        'Login expired. Open claude with this account in your terminal to renew it.'
      )
    }
    await writeLinkedFolderCredentials(configDir, renewed, deps)
    credentialsJson = renewed
  }
  const token = parseClaudeOAuthCredentialsJson(credentialsJson, 'credentials-file').token
  if (!token) {
    return errorResult('No credentials')
  }
  return (deps.fetchUsage ?? fetchClaudeOAuthUsage)(token, options.signal)
}
