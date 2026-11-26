import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { InactiveAccountUsage, ProviderRateLimits } from '../../../../shared/rate-limit-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { claudeAccountDisplayName } from '../../../../shared/claude-api-account'
import { parseWslUncPath } from '../../../../shared/wsl-paths'
import {
  projectAgentAccountId,
  resolveWorktreeAgentAccount
} from '../../../../shared/worktree-agent-account'

/** Usage older than this is refetched when the user switches to a project on that account. */
export const FOOTER_ACCOUNT_USAGE_MAX_AGE_MS = 5 * 60_000

export type FooterClaudeAccount = {
  accountId: string | null
  email: string | null
  /** True when the selected project runs on an account other than the active one. */
  fromProject: boolean
  /** Set when the project's pin makes plain Claude refuse to launch instead of using an account. */
  launchRefused?: 'api-key-account'
}

type Settings = Pick<
  GlobalSettings,
  | 'claudeManagedAccounts'
  | 'activeClaudeManagedAccountId'
  | 'activeClaudeManagedAccountIdsByRuntime'
  | 'activeRuntimeEnvironmentId'
>

function activeHostAccountId(settings: Settings): string | null {
  return (
    settings.activeClaudeManagedAccountIdsByRuntime?.host ??
    settings.activeClaudeManagedAccountId ??
    null
  )
}

function emailOf(settings: Settings, accountId: string | null): string | null {
  const account = accountId
    ? settings.claudeManagedAccounts.find((candidate) => candidate.id === accountId)
    : undefined
  return account ? claudeAccountDisplayName(account) || null : null
}

/**
 * The Claude account a launch in the selected workspace uses: the workspace's pin, else the
 * project's default, else the active account. Same rule as the launch itself and the sidebar badge.
 */
export function resolveFooterClaudeAccount(input: {
  settings: Settings | null
  worktree: Pick<Worktree, 'agentAccountId' | 'path'> | null
  repo: Pick<Repo, 'claudeAccountId' | 'connectionId'> | null
}): FooterClaudeAccount {
  const { settings, worktree, repo } = input
  if (!settings) {
    return { accountId: null, email: null, fromProject: false }
  }
  const activeId = activeHostAccountId(settings)
  const global = { accountId: activeId, email: emailOf(settings, activeId), fromProject: false }
  // Why: a remote server or SSH project launches with that host's accounts, not this PC's.
  if (settings.activeRuntimeEnvironmentId?.trim() || repo?.connectionId) {
    return global
  }
  const pin = worktree?.agentAccountId ?? projectAgentAccountId(repo, 'claude')
  const wsl = worktree ? parseWslUncPath(worktree.path) : null
  const resolution = resolveWorktreeAgentAccount({
    agentAccountId: pin,
    agent: 'claude',
    target: wsl ? { runtime: 'wsl', wslDistro: wsl.distro } : { runtime: 'host' },
    settings
  })
  // Why: the launch is refused, so naming the active account would claim a fallback that never runs.
  if (resolution.kind === 'unavailable' && resolution.reason === 'api-key-account') {
    return {
      accountId: resolution.accountId,
      email: emailOf(settings, resolution.accountId),
      fromProject: true,
      launchRefused: 'api-key-account'
    }
  }
  if (resolution.kind !== 'override' || resolution.accountId === activeId) {
    return global
  }
  return {
    accountId: resolution.accountId,
    email: emailOf(settings, resolution.accountId),
    fromProject: true
  }
}

/** The usage row the footer shows for a project account that is not the active one. */
export function projectAccountUsage(
  claude: ProviderRateLimits | null,
  inactive: readonly InactiveAccountUsage[],
  account: FooterClaudeAccount
): ProviderRateLimits | null {
  if (!account.fromProject) {
    return claude
  }
  const entry = inactive.find((candidate) => candidate.accountId === account.accountId)
  if (entry?.rateLimits) {
    return entry.rateLimits
  }
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: entry?.updatedAt ?? 0,
    error: null,
    // Why: linked folders have no background usage; say "--" rather than spin forever.
    status: entry?.isFetching ? 'fetching' : 'unavailable'
  }
}

/** Whether switching to this project should fetch its account's usage. */
export function shouldFetchProjectAccountUsage(
  inactive: readonly InactiveAccountUsage[],
  account: FooterClaudeAccount,
  now: number
): boolean {
  if (!account.fromProject) {
    return false
  }
  const entry = inactive.find((candidate) => candidate.accountId === account.accountId)
  return !entry || (!entry.isFetching && now - entry.updatedAt > FOOTER_ACCOUNT_USAGE_MAX_AGE_MS)
}
