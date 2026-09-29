import type {
  BitbucketConnectArgs,
  BitbucketConnectionStatus
} from '../../shared/bitbucket-credentials'
import type {
  CreateHostedReviewArgs,
  CreateHostedReviewResult,
  CreateStackedHostedReviewArgs,
  CreateStackedHostedReviewResult,
  HostedReviewCreationEligibility,
  HostedReviewCreationEligibilityArgs,
  HostedReviewForBranchArgs,
  HostedReviewInfo
} from '../../shared/hosted-review'
import type {
  HostedReviewActionArgs,
  HostedReviewActionResult,
  HostedReviewDetails,
  HostedReviewDetailsArgs,
  HostedReviewSearchBranchesArgs
} from '../../shared/hosted-review-actions'

export type HostedReviewApi = {
  forBranch: (args: HostedReviewForBranchArgs) => Promise<HostedReviewInfo | null>
  getCreationEligibility: (
    args: HostedReviewCreationEligibilityArgs
  ) => Promise<HostedReviewCreationEligibility>
  create: (args: CreateHostedReviewArgs) => Promise<CreateHostedReviewResult>
  createStacked: (args: CreateStackedHostedReviewArgs) => Promise<CreateStackedHostedReviewResult>
  details: (args: HostedReviewDetailsArgs) => Promise<HostedReviewDetails | null>
  action: (args: HostedReviewActionArgs) => Promise<HostedReviewActionResult>
  searchBranches: (args: HostedReviewSearchBranchesArgs) => Promise<string[]>
}

export type BitbucketApi = {
  connect: (
    args: BitbucketConnectArgs
  ) => Promise<{ ok: true; account: string | null } | { ok: false; error: string }>
  disconnect: () => Promise<void>
  status: () => Promise<BitbucketConnectionStatus>
}
