// Open pull requests across the Azure DevOps organization that involve the signed-in
// user (author or reviewer), enriched with policies, threads and linked work items.

export type AzureDevOpsPullRequestSituation =
  | 'conflicts'
  | 'rejected'
  | 'build_failed'
  | 'waiting_author'
  | 'pending'
  | 'approved'
  | 'draft'

// Azure DevOps vote codes: 10 approved, 5 approved with suggestions, 0 none,
// -5 waiting for author, -10 rejected.
export type AzureDevOpsPullRequestVote = number

export type AzureDevOpsPullRequestReviewer = {
  id: string
  displayName: string
  uniqueName: string
  // Avatar URL as Azure DevOps returns it; fetched through the host, never directly.
  imageUrl: string
  vote: AzureDevOpsPullRequestVote
  isRequired: boolean
  // True for groups/teams, which are the ones that release the merge when present.
  isContainer: boolean
}

export type AzureDevOpsPullRequestPolicyStatus =
  | 'queued'
  | 'running'
  | 'approved'
  | 'rejected'
  | 'notApplicable'
  | 'broken'
  | (string & {})

export type AzureDevOpsPullRequestPolicy = {
  name: string
  status: AzureDevOpsPullRequestPolicyStatus
  isBlocking: boolean
}

// Machine-readable signal; the renderer turns it into translated text.
export type AzureDevOpsPullRequestSignal =
  | { kind: 'conflicts' }
  | { kind: 'rejected'; count: number }
  | { kind: 'waiting-author'; count: number }
  | { kind: 'policy-failed'; names: string[] }
  | { kind: 'unresolved-threads'; count: number }
  | { kind: 'validation-running' }
  | { kind: 'approvals'; count: number }
  | { kind: 'person-approvals-missing-group'; count: number }
  | { kind: 'nothing-pending' }

export type AzureDevOpsBoardPullRequest = {
  id: number
  title: string
  project: string
  repository: string
  repositoryId: string
  sourceBranch: string
  targetBranch: string
  createdBy: string
  createdByEmail: string
  creationDate: string
  isDraft: boolean
  mergeStatus: string
  url: string
  reviewers: AzureDevOpsPullRequestReviewer[]
  policies: AzureDevOpsPullRequestPolicy[]
  activeThreads: number
  totalThreads: number
  workItemIds: number[]
  isMine: boolean
  isReviewer: boolean
  situation: AzureDevOpsPullRequestSituation
  signals: AzureDevOpsPullRequestSignal[]
  ageDays: number
}

export type AzureDevOpsBoardWorkItem = {
  id: number
  title: string
  workItemType: string
  state: string
  // Team project of the work item, which can differ from the pull request's project.
  project: string
  url: string
}

export type AzureDevOpsBoardIdentity = {
  id: string
  displayName: string
  email: string
}

export type AzureDevOpsPullRequestBoard = {
  identity: AzureDevOpsBoardIdentity
  organizationUrl: string
  // Most urgent first, oldest first on ties.
  pullRequests: AzureDevOpsBoardPullRequest[]
  // Keyed by work item id as a string; missing ids mean the details did not load.
  workItems: Record<string, AzureDevOpsBoardWorkItem>
  fetchedAt: number
}

export type AzureDevOpsPullRequestBoardResult =
  | { ok: true; board: AzureDevOpsPullRequestBoard }
  | { ok: false; error: string }

// A human comment on a pull request thread (system and deleted ones are dropped).
export type AzureDevOpsPullRequestComment = {
  id: number
  threadId: number
  authorId: string
  authorName: string
  authorEmail: string
  content: string
  // ISO timestamp as Azure DevOps returned it; may be unparseable.
  published: string
  // Thread status: active, fixed, wontFix, byDesign, closed, pending or unknown.
  threadStatus: string
  filePath: string | null
  line: number | null
  isReply: boolean
}

export type AzureDevOpsPullRequestCommentsArgs = {
  project: string
  repositoryId: string
  pullRequestId: number
}

// Newest first.
export type AzureDevOpsPullRequestCommentsResult =
  | { ok: true; comments: AzureDevOpsPullRequestComment[] }
  | { ok: false; error: string }

export type AzureDevOpsReviewerAvatarResult =
  | { ok: true; dataUri: string }
  | { ok: false; error: string }
