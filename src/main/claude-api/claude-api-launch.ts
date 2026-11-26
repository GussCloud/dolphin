import { buildClaudeApiClaudeEnv, readClaudeApiAccountEnv } from '../../shared/claude-api-provider'
import { isClaudeApiKeyAccount } from '../../shared/claude-api-account'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { readClaudeApiKey } from '../claude-accounts/claude-api-key-store'
import { installClaudeProfileHooks } from '../claude-accounts/profile/claude-profile-hooks'
import {
  claudeConfigDirHoldsSession,
  readClaudeSpawnResumeSessionId
} from '../claude-accounts/profile/claude-session-profile'
import {
  findLaunchWorktree,
  type WorktreeAccountMetaSource,
  type WorktreeLaunchLocation
} from '../worktree-launch-owner'
import { preapproveClaudeApiKeyInProfile } from './claude-api-key-approval'
import {
  resolveClaudeApiLaunchAccount,
  type ClaudeApiLaunchAccountSettings
} from './claude-api-launch-account'

export const CLAUDE_API_SSH_UNSUPPORTED_MESSAGE =
  'The Claude API agent can only start on this computer, not on an SSH host.'
export const CLAUDE_API_WSL_UNSUPPORTED_MESSAGE =
  'The Claude API agent cannot start in WSL yet. Open the workspace with a native terminal.'
export const CLAUDE_API_MISSING_KEY_MESSAGE =
  'This API account has no API key. Save one in Settings > Accounts, then start the agent again.'
export const CLAUDE_API_UNREADABLE_KEY_MESSAGE =
  'The API key of this account could not be read. Save it again in Settings > Accounts.'

type ClaudeApiLaunchSettings = ClaudeApiLaunchAccountSettings &
  Partial<Pick<GlobalSettings, 'agentCmdOverrides' | 'agentStatusHooksEnabled'>>

export type ClaudeApiLaunchRequest = {
  connectionId: string | null | undefined
  target: { runtime?: 'host' | 'wsl'; wslDistro?: string | null }
  settings: ClaudeApiLaunchSettings | undefined
  /** The pane's own env: carries the account of a relaunch, resume or teammate. */
  launchEnv: Record<string, string | undefined> | undefined
  /** The spawn command; a `claude --resume <id>` runs in the profile holding that transcript. */
  command: string | undefined
  launch: WorktreeLaunchLocation
}

export type ClaudeApiLaunchDeps = {
  readApiKey: (accountId: string) => string | null
  configDirFor: (account: ClaudeManagedAccount) => string
  holdsSession: (configDir: string, sessionId: string) => boolean
  worktreeSource: () => WorktreeAccountMetaSource | null
  prepareProfile: (
    profileDir: string,
    apiKey: string,
    settings: ClaudeApiLaunchSettings
  ) => Promise<void>
}

export const CLAUDE_API_ACCOUNTS_UNAVAILABLE_MESSAGE =
  'Claude accounts are not available in this process, so the Claude API agent cannot start.'

/** What the launch needs from the process that owns Claude accounts. */
export type ClaudeApiLaunchSource = {
  /** The store holding worktree pins. */
  worktreeSource: WorktreeAccountMetaSource
  /** An account's profile dir; owned by the account service so this module stays Electron-free. */
  configDirFor: (account: ClaudeManagedAccount) => string
  /** Current settings, for callers (Agent Teams) that do not hold them. */
  getSettings?: () => ClaudeApiLaunchSettings | undefined
}

let launchSource: ClaudeApiLaunchSource | null = null

/** Installed by the runtime auth service; every process has at most one. */
export function registerClaudeApiLaunchSource(next: ClaudeApiLaunchSource | null): void {
  launchSource = next
}

function requireLaunchSource(): ClaudeApiLaunchSource {
  // Why refuse: without the account service there is no profile to run in, and no fallback is safe.
  if (!launchSource) {
    throw new Error(CLAUDE_API_ACCOUNTS_UNAVAILABLE_MESSAGE)
  }
  return launchSource
}

async function prepareClaudeApiProfile(
  profileDir: string,
  apiKey: string,
  settings: ClaudeApiLaunchSettings
): Promise<void> {
  // Why best-effort: a missing approval or hook degrades the first prompt or status, not billing.
  try {
    await preapproveClaudeApiKeyInProfile(profileDir, apiKey)
  } catch (error) {
    console.warn(
      '[claude-api] failed to pre-approve the API key',
      error instanceof Error ? error.message : ''
    )
  }
  try {
    await installClaudeProfileHooks(profileDir, settings)
  } catch (error) {
    console.warn(
      '[claude-api] failed to install managed hooks',
      error instanceof Error ? error.message : ''
    )
  }
}

const defaultDeps: ClaudeApiLaunchDeps = {
  readApiKey: readClaudeApiKey,
  configDirFor: (account) => requireLaunchSource().configDirFor(account),
  holdsSession: claudeConfigDirHoldsSession,
  worktreeSource: () => requireLaunchSource().worktreeSource,
  prepareProfile: prepareClaudeApiProfile
}

/** The API account whose profile holds the transcript `command` resumes, if any. */
export function findClaudeApiResumeOwner(
  settings: ClaudeApiLaunchAccountSettings | undefined,
  command: string | undefined,
  deps: Pick<ClaudeApiLaunchDeps, 'configDirFor' | 'holdsSession'> = defaultDeps
): ClaudeManagedAccount | null {
  const apiAccounts = (settings?.claudeManagedAccounts ?? []).filter(isClaudeApiKeyAccount)
  const sessionId = apiAccounts.length > 0 ? readClaudeSpawnResumeSessionId(command) : null
  // Why: with no account service in this process a plain resume keeps its own path.
  if (!sessionId || (deps === defaultDeps && !launchSource)) {
    return null
  }
  return (
    apiAccounts.find((account) => deps.holdsSession(deps.configDirFor(account), sessionId)) ?? null
  )
}

/**
 * The API account an Agent Teams leader bills, for its team env; null when it cannot be decided
 * here (the leader's own spawn then refuses with the reason, and teammates stay in-process).
 */
export function resolveClaudeApiTeamAccountId(
  request: Pick<ClaudeApiLaunchRequest, 'launchEnv' | 'command' | 'launch'> &
    Partial<Pick<ClaudeApiLaunchRequest, 'settings'>>,
  deps: ClaudeApiLaunchDeps = defaultDeps
): string | null {
  // Why the full order, not the pane account first: the leader's own spawn puts a resumed
  // transcript's owner ahead of it, and teammates must bill the account the leader runs on.
  const settings = request.settings ?? launchSource?.getSettings?.()
  try {
    return resolveRequestAccount({ ...request, settings }, deps).id
  } catch {
    // Why the pane account still counts: with no account service here the order cannot run, and a
    // gone account only makes each teammate refuse, which is the same outcome as the leader's.
    return readClaudeApiAccountEnv(request.launchEnv)
  }
}

function resolveRequestAccount(
  request: Pick<ClaudeApiLaunchRequest, 'settings' | 'launchEnv' | 'command' | 'launch'>,
  deps: ClaudeApiLaunchDeps
): ClaudeManagedAccount {
  const settings = request.settings ?? {}
  const source = deps.worktreeSource()
  return resolveClaudeApiLaunchAccount(settings, {
    resumeOwnerAccountId: findClaudeApiResumeOwner(settings, request.command, deps)?.id ?? null,
    paneAccountId: readClaudeApiAccountEnv(request.launchEnv),
    worktreePinAccountId: source
      ? (findLaunchWorktree(source, request.launch)?.meta.agentAccountId ?? null)
      : null
  })
}

/**
 * The env a `claude-api` launch needs: the account's profile as CLAUDE_CONFIG_DIR and its key.
 * Throws a user-facing error whenever that is impossible; it never falls back to another login.
 */
export async function prepareClaudeApiLaunch(
  request: ClaudeApiLaunchRequest,
  deps: ClaudeApiLaunchDeps = defaultDeps
): Promise<Record<string, string>> {
  // Why: the key would cross the relay into a remote home Dolphin does not manage.
  if (request.connectionId) {
    throw new Error(CLAUDE_API_SSH_UNSUPPORTED_MESSAGE)
  }
  // Why: wsl.exe forwards env only through WSLENV and the profile dir is a host path.
  if (request.target.runtime === 'wsl') {
    throw new Error(CLAUDE_API_WSL_UNSUPPORTED_MESSAGE)
  }
  const settings = request.settings ?? {}
  const account = resolveRequestAccount(request, deps)
  let apiKey: string | null
  try {
    apiKey = deps.readApiKey(account.id)
  } catch {
    throw new Error(CLAUDE_API_UNREADABLE_KEY_MESSAGE)
  }
  if (!apiKey?.trim()) {
    throw new Error(CLAUDE_API_MISSING_KEY_MESSAGE)
  }
  const configDir = deps.configDirFor(account)
  await deps.prepareProfile(configDir, apiKey, settings)
  return buildClaudeApiClaudeEnv({ apiKey, accountId: account.id, configDir })
}
