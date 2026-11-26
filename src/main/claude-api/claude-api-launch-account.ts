import { isClaudeApiKeyAccount } from '../../shared/claude-api-account'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'

export type ClaudeApiLaunchAccountSettings = Partial<
  Pick<
    GlobalSettings,
    'claudeManagedAccounts' | 'codexManagedAccounts' | 'claudeApiDefaultAccountId'
  >
>

export const CLAUDE_API_NO_ACCOUNT_MESSAGE =
  'The Claude API agent needs an API account. Add one in Settings > Accounts, then start the agent again.'
export const CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE =
  'Choose which API account the Claude API agent uses: set a default in Settings > Accounts, or pick one for this workspace.'
export const CLAUDE_API_ACCOUNT_GONE_MESSAGE =
  'The API account chosen for this launch no longer exists. Pick another API account and start the agent again.'

/** Where the account of a launch came from; the order is the precedence. */
export type ClaudeApiLaunchAccountChoice = {
  /** The API account whose profile holds the transcript being resumed. */
  resumeOwnerAccountId: string | null
  /** `DOLPHIN_CLAUDE_API_ACCOUNT` from the pane env (relaunches, resumes, teammates). */
  paneAccountId: string | null
  /** The launch worktree's `agentAccountId` pin, of any agent. */
  worktreePinAccountId: string | null
}

function apiAccounts(settings: ClaudeApiLaunchAccountSettings): ClaudeManagedAccount[] {
  return (settings.claudeManagedAccounts ?? []).filter((account) => isClaudeApiKeyAccount(account))
}

/**
 * The API account a `claude-api` launch bills. Throws a user-facing error instead of choosing a
 * different account: an explicit choice that no longer resolves is never replaced by another one.
 */
export function resolveClaudeApiLaunchAccount(
  settings: ClaudeApiLaunchAccountSettings,
  choice: ClaudeApiLaunchAccountChoice
): ClaudeManagedAccount {
  const accounts = apiAccounts(settings)
  const byId = (id: string): ClaudeManagedAccount | undefined =>
    accounts.find((account) => account.id === id)
  const explicit = choice.resumeOwnerAccountId ?? choice.paneAccountId
  if (explicit) {
    const account = byId(explicit)
    if (!account) {
      throw new Error(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
    }
    return account
  }
  const pin = choice.worktreePinAccountId
  if (pin) {
    const pinned = byId(pin)
    if (pinned) {
      return pinned
    }
    // Why: a pin that names a plan or Codex account belongs to another agent; an unknown id is a
    // deleted API account, and billing another API account in its place would mix two budgets.
    const belongsToOtherAgent = [
      ...(settings.claudeManagedAccounts ?? []),
      ...(settings.codexManagedAccounts ?? [])
    ].some((account) => account.id === pin)
    if (!belongsToOtherAgent) {
      throw new Error(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
    }
  }
  const defaultId = settings.claudeApiDefaultAccountId?.trim()
  if (defaultId) {
    const account = byId(defaultId)
    if (!account) {
      throw new Error(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
    }
    return account
  }
  if (accounts.length === 1) {
    return accounts[0]!
  }
  throw new Error(
    accounts.length === 0 ? CLAUDE_API_NO_ACCOUNT_MESSAGE : CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE
  )
}
