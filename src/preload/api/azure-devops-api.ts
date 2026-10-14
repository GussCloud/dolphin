import type {
  AzureDevOpsAuthMethod,
  AzureDevOpsAuthPreference,
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
}
