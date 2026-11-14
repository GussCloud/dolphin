import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import { readActiveClaudeKeychainCredentialsStrict } from '../claude-accounts/keychain'
import { isOauthTokenExpiring } from '../claude-accounts/oauth-refresh'
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
async function readLinkedFolderCredentials(
  configDir: string,
  deps: LinkedFolderUsageDeps
): Promise<string | null> {
  const platform = deps.platform ?? process.platform
  if (platform === 'darwin') {
    const isDefault = resolve(configDir) === resolve(deps.home ?? homedir(), '.claude')
    // Why: the default dir's Keychain item is the unsuffixed one; any other dir's is keyed by path.
    return (deps.readKeychain ?? readActiveClaudeKeychainCredentialsStrict)(
      isDefault ? undefined : configDir
    ).catch(() => null)
  }
  return (deps.readFile ?? readFileOrNull)(join(configDir, '.credentials.json'))
}

/**
 * Usage of an account whose folder the user manages (a linked folder). Never refreshes or writes:
 * its single-use refresh token belongs to the user's own terminal, which renews it when it runs.
 */
export async function fetchLinkedFolderClaudeUsage(
  configDir: string,
  options: ClaudeManagedAccountUsageOptions = {},
  deps: LinkedFolderUsageDeps = {}
): Promise<ProviderRateLimits> {
  if (options.signal?.aborted) {
    return abortedClaudeRateLimitResult()
  }
  const credentialsJson = await readLinkedFolderCredentials(configDir, deps)
  if (!credentialsJson) {
    return errorResult('No credentials')
  }
  if (isOauthTokenExpiring(credentialsJson)) {
    return errorResult('Login expired. Open claude with this account in your terminal to renew it.')
  }
  const token = parseClaudeOAuthCredentialsJson(credentialsJson, 'credentials-file').token
  if (!token) {
    return errorResult('No credentials')
  }
  return (deps.fetchUsage ?? fetchClaudeOAuthUsage)(token, options.signal)
}
