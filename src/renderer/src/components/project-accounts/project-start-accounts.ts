import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type {
  CommitIdentity,
  RepoAccountBinding
} from '../../../../shared/source-control-account-types'
import type { ProjectAccountSelection } from './project-account-options'
import type { ProjectRemoteTarget } from './project-account-provider'

/** Accounts picked on the first "Add a project" screen, before the path or remote is known. */
export type ProjectStartAccounts = {
  /** Null keeps gh's active login. */
  ghAccount: GhAccountBinding | null
  /** Null keeps the default Azure DevOps sign-in. */
  azureDevOpsAccountId: string | null
  /** Managed Claude account; null keeps the active account. */
  claudeAccountId: string | null
  /** Managed Codex account; null keeps the active account. */
  codexAccountId: string | null
  /** Author suggested from the chosen GitHub account; editable later in each flow. */
  commitIdentity: CommitIdentity | null
}

export const EMPTY_PROJECT_START_ACCOUNTS: ProjectStartAccounts = {
  ghAccount: null,
  azureDevOpsAccountId: null,
  claudeAccountId: null,
  codexAccountId: null,
  commitIdentity: null
}

export function hasProjectStartChoice(accounts: ProjectStartAccounts): boolean {
  return Boolean(
    accounts.ghAccount ||
    accounts.azureDevOpsAccountId ||
    accounts.claudeAccountId ||
    accounts.codexAccountId ||
    accounts.commitIdentity
  )
}

/**
 * The binding a new project receives from the first-screen choices.
 * `target` is the project's remote: a choice for another provider or GitHub host is dropped,
 * because it would never authenticate that remote. `'no-remote'` (Create) keeps both providers
 * for the remote the user adds later.
 */
export function projectStartBinding(
  accounts: ProjectStartAccounts,
  target: ProjectRemoteTarget | null | 'no-remote'
): RepoAccountBinding {
  const githubMatches =
    accounts.ghAccount !== null &&
    (target === 'no-remote' ||
      (target?.provider === 'github' &&
        target.host.toLowerCase() === accounts.ghAccount.host.toLowerCase()))
  const azureMatches =
    accounts.azureDevOpsAccountId !== null &&
    (target === 'no-remote' || target?.provider === 'azure-devops')
  return {
    ...(githubMatches && accounts.ghAccount ? { ghAccount: accounts.ghAccount } : {}),
    ...(azureMatches && accounts.azureDevOpsAccountId
      ? { azureDevOpsAccountId: accounts.azureDevOpsAccountId }
      : {}),
    ...(accounts.claudeAccountId ? { claudeAccountId: accounts.claudeAccountId } : {}),
    ...(accounts.codexAccountId ? { codexAccountId: accounts.codexAccountId } : {}),
    ...(accounts.commitIdentity ? { commitIdentity: accounts.commitIdentity } : {})
  }
}

/** The clone form's preselection for a remote, from the first-screen choice of that provider. */
export function preferredCloneSelection(
  accounts: ProjectStartAccounts,
  target: ProjectRemoteTarget | null
): ProjectAccountSelection | null {
  if (!target) {
    return null
  }
  if (target.provider === 'azure-devops') {
    return accounts.azureDevOpsAccountId
      ? { provider: 'azure-devops', azureDevOpsAccountId: accounts.azureDevOpsAccountId }
      : null
  }
  return accounts.ghAccount && accounts.ghAccount.host.toLowerCase() === target.host.toLowerCase()
    ? { provider: 'github', ghAccount: accounts.ghAccount }
    : null
}

/** Create's binding: the author the user left in the form, plus every first-screen account. */
export function createProjectBinding(
  accounts: ProjectStartAccounts | undefined,
  identity: CommitIdentity | null
): RepoAccountBinding {
  const binding = accounts
    ? projectStartBinding({ ...accounts, commitIdentity: null }, 'no-remote')
    : {}
  return identity ? { ...binding, commitIdentity: identity } : binding
}

export type StartAgent = 'claude' | 'codex'

/** Only the agent accounts, for flows whose Git account comes from their own form (clone). */
export function startAgentAccounts(
  accounts: ProjectStartAccounts | undefined
): Pick<RepoAccountBinding, 'claudeAccountId' | 'codexAccountId'> {
  return {
    ...(accounts?.claudeAccountId ? { claudeAccountId: accounts.claudeAccountId } : {}),
    ...(accounts?.codexAccountId ? { codexAccountId: accounts.codexAccountId } : {})
  }
}
