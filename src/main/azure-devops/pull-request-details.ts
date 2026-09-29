import type {
  HostedReviewDetails,
  HostedReviewReviewer,
  HostedReviewThread,
  HostedReviewThreadComment,
  HostedReviewVote
} from '../../shared/hosted-review-actions'
import { resolveAzureDevOpsGitApiBaseUrl } from './azure-devops-api-request'
import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'
import { mapAzureDevOpsPullRequest, mapAzureDevOpsPullRequestState } from './pull-request-mappers'
import type { AzureDevOpsRepoRef } from './repository-ref'

type RawIdentity = { id?: string | null; displayName?: string | null; uniqueName?: string | null }

type RawReviewer = RawIdentity & { vote?: number | null; isRequired?: boolean | null }

export type RawAzureDevOpsPullRequestDetail = {
  pullRequestId?: number
  title?: string | null
  description?: string | null
  status?: string | null
  isDraft?: boolean | null
  creationDate?: string | null
  sourceRefName?: string | null
  targetRefName?: string | null
  mergeStatus?: string | null
  createdBy?: RawIdentity | null
  reviewers?: RawReviewer[] | null
  lastMergeSourceCommit?: { commitId?: string | null } | null
}

type RawThreadComment = {
  id?: number
  content?: string | null
  publishedDate?: string | null
  commentType?: string | null
  isDeleted?: boolean | null
  author?: RawIdentity | null
}

type RawThread = {
  id?: number
  status?: string | null
  isDeleted?: boolean | null
  threadContext?: { filePath?: string | null; rightFileStart?: { line?: number } | null } | null
  comments?: RawThreadComment[] | null
}

const VOTES: readonly [number, HostedReviewVote][] = [
  [10, 'approved'],
  [5, 'approved-with-suggestions'],
  [0, 'no-vote'],
  [-5, 'waiting-for-author'],
  [-10, 'rejected']
]

export function azureDevOpsVoteValue(vote: HostedReviewVote): number {
  return VOTES.find(([, name]) => name === vote)?.[0] ?? 0
}

export function mapAzureDevOpsVote(value: number | null | undefined): HostedReviewVote {
  return VOTES.find(([number]) => number === value)?.[1] ?? 'no-vote'
}

export function pullRequestPath(repo: AzureDevOpsRepoRef, number: number): string {
  return `/_apis/git/repositories/${encodeURIComponent(repo.repository)}/pullRequests/${number}`
}

/** Organization/collection base: the project-level API base minus the project segment. */
export function azureDevOpsCollectionBaseUrl(repo: AzureDevOpsRepoRef): string {
  return resolveAzureDevOpsGitApiBaseUrl(repo).replace(/\/[^/]+\/?$/, '')
}

export async function getAzureDevOpsCurrentUserId(
  repo: AzureDevOpsRepoRef
): Promise<string | null> {
  const connection = await sendAzureDevOpsRequest(
    azureDevOpsCollectionBaseUrl(repo),
    '/_apis/connectionData',
    { method: 'GET' }
  )
  if (connection && typeof connection === 'object' && 'authenticatedUser' in connection) {
    const user = connection.authenticatedUser
    const id = user && typeof user === 'object' && 'id' in user ? user.id : null
    return typeof id === 'string' ? id : null
  }
  return null
}

function stripRef(ref: string | null | undefined): string {
  return (ref ?? '').replace(/^refs\/heads\//, '')
}

function mapComment(raw: RawThreadComment): HostedReviewThreadComment | null {
  if (raw.isDeleted || raw.commentType === 'system' || typeof raw.id !== 'number') {
    return null
  }
  return {
    id: raw.id,
    author: raw.author?.displayName ?? raw.author?.uniqueName ?? '',
    content: raw.content ?? '',
    createdAt: raw.publishedDate ?? ''
  }
}

export function mapAzureDevOpsThreads(raw: readonly RawThread[]): HostedReviewThread[] {
  const threads: HostedReviewThread[] = []
  for (const thread of raw) {
    const comments = (thread.comments ?? []).flatMap((comment) => mapComment(comment) ?? [])
    // System threads (votes, pushes) carry only system comments and drop out here.
    if (thread.isDeleted || typeof thread.id !== 'number' || comments.length === 0) {
      continue
    }
    const status = thread.status?.toLowerCase()
    threads.push({
      id: thread.id,
      status: !status || status === 'active' || status === 'pending' ? 'active' : 'resolved',
      filePath: thread.threadContext?.filePath ?? null,
      line: thread.threadContext?.rightFileStart?.line ?? null,
      comments
    })
  }
  return threads
}

export function mapAzureDevOpsPullRequestDetails(
  raw: RawAzureDevOpsPullRequestDetail,
  threads: readonly RawThread[],
  currentUserId: string | null,
  webBaseUrl: string
): HostedReviewDetails | null {
  const summary = mapAzureDevOpsPullRequest(raw, 'neutral', webBaseUrl)
  if (!summary) {
    return null
  }
  const state = mapAzureDevOpsPullRequestState(raw)
  const open = state === 'open' || state === 'draft'
  const reviewers: HostedReviewReviewer[] = (raw.reviewers ?? []).flatMap((reviewer) =>
    reviewer.id
      ? [
          {
            id: reviewer.id,
            displayName: reviewer.displayName ?? reviewer.uniqueName ?? reviewer.id,
            uniqueName: reviewer.uniqueName ?? null,
            vote: mapAzureDevOpsVote(reviewer.vote),
            isRequired: reviewer.isRequired === true,
            isCurrentUser: reviewer.id === currentUserId
          }
        ]
      : []
  )
  return {
    provider: 'azure-devops',
    number: summary.number,
    title: summary.title,
    description: raw.description ?? '',
    state,
    isDraft: raw.isDraft === true,
    url: summary.url,
    author: raw.createdBy?.displayName ?? raw.createdBy?.uniqueName ?? null,
    sourceBranch: stripRef(raw.sourceRefName),
    targetBranch: stripRef(raw.targetRefName),
    createdAt: raw.creationDate ?? null,
    hasConflicts: raw.mergeStatus?.toLowerCase() === 'conflicts',
    reviewers,
    threads: mapAzureDevOpsThreads(threads),
    capabilities: {
      vote: open && currentUserId !== null,
      editReviewers: open,
      complete: open && !raw.isDraft,
      abandon: open,
      reopen: state === 'closed',
      comment: true,
      resolveThreads: true,
      edit: open,
      toggleDraft: open,
      mergeStrategies: ['merge', 'squash', 'rebase', 'rebase-merge']
    }
  }
}

export async function fetchAzureDevOpsPullRequestDetails(
  repo: AzureDevOpsRepoRef,
  number: number
): Promise<HostedReviewDetails | null> {
  const baseUrl = resolveAzureDevOpsGitApiBaseUrl(repo)
  const path = pullRequestPath(repo, number)
  const [pullRequest, threads, currentUserId] = await Promise.all([
    sendAzureDevOpsRequest(baseUrl, path, { method: 'GET' }),
    sendAzureDevOpsRequest(baseUrl, `${path}/threads`, { method: 'GET' }),
    // A failed identity lookup only hides the vote buttons.
    getAzureDevOpsCurrentUserId(repo).catch(() => null)
  ])
  if (!pullRequest || typeof pullRequest !== 'object') {
    return null
  }
  const threadList =
    threads && typeof threads === 'object' && 'value' in threads && Array.isArray(threads.value)
      ? threads.value
      : []
  return mapAzureDevOpsPullRequestDetails(pullRequest, threadList, currentUserId, repo.webBaseUrl)
}
