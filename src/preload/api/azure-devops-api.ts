import type {
  AzureDevOpsAuthMethod,
  AzureDevOpsAuthPreference,
  AzureCliSignInMode,
  AzureCliSignInResult,
  AzureCliSignInState,
  AzureDevOpsConfigureDefaultsResult,
  AzureDevOpsRepositoriesResult
} from '../../shared/azure-devops-auth'
import type {
  AzureDevOpsPullRequestBoardResult,
  AzureDevOpsPullRequestCommentsArgs,
  AzureDevOpsPullRequestCommentsResult,
  AzureDevOpsReviewerAvatarResult
} from '../../shared/azure-devops-pull-request-board'
import type {
  AzureDevOpsOrgLinkArgs,
  AzureDevOpsOrgLinkStatus
} from '../../shared/azure-devops-org-link'
import type { AzureDevOpsManagedAccount } from '../../shared/source-control-account-types'

export type AzureDevOpsApi = {
  setAuthMethod: (method: AzureDevOpsAuthMethod) => Promise<AzureDevOpsAuthPreference>
  configureCliDefaults: (args: {
    organization: string
    project: string | null
  }) => Promise<AzureDevOpsConfigureDefaultsResult>
  setCliAutoRenew: (enabled: boolean) => Promise<AzureDevOpsAuthPreference>
  refreshCliSession: () => Promise<void>
  listRepositories: () => Promise<AzureDevOpsRepositoriesResult>
  pullRequestBoard: () => Promise<AzureDevOpsPullRequestBoardResult>
  pullRequestComments: (
    args: AzureDevOpsPullRequestCommentsArgs
  ) => Promise<AzureDevOpsPullRequestCommentsResult>
  reviewerAvatar: (url: string) => Promise<AzureDevOpsReviewerAvatarResult>
  orgLink: (args?: AzureDevOpsOrgLinkArgs) => Promise<AzureDevOpsOrgLinkStatus>
  getCliSignInState: () => Promise<AzureCliSignInState>
  // Resolves once `az login` ends: signed in, cancelled, failed or timed out.
  startCliSignIn: (mode: AzureCliSignInMode) => Promise<AzureCliSignInResult>
  cancelCliSignIn: () => Promise<void>
  onCliSignInStateChanged: (callback: (state: AzureCliSignInState) => void) => () => void
  /** Per-project accounts, each signed in through its own isolated Azure CLI config dir. */
  listManagedAccounts: () => Promise<AzureDevOpsManagedAccount[]>
  // Resolves once the isolated `az login` ends; cancel with cancelCliSignIn.
  addManagedAccount: (
    mode: AzureCliSignInMode
  ) => Promise<{ ok: true; account: AzureDevOpsManagedAccount } | { ok: false; error: string }>
  /** Also unbinds every project that used the account. */
  removeManagedAccount: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
}
