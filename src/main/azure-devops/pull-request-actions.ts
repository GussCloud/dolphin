import type {
  HostedReviewAction,
  HostedReviewActionResult,
  HostedReviewMergeStrategy
} from '../../shared/hosted-review-actions'
import { resolveAzureDevOpsGitApiBaseUrl } from './azure-devops-api-request'
import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'
import { resolveAzureDevOpsIdentityId } from './identity-search'
import {
  azureDevOpsVoteValue,
  getAzureDevOpsCurrentUserId,
  pullRequestPath,
  type RawAzureDevOpsPullRequestDetail
} from './pull-request-details'
import type { AzureDevOpsRepoRef } from './repository-ref'

const MERGE_STRATEGIES: Record<HostedReviewMergeStrategy, string> = {
  merge: 'noFastForward',
  squash: 'squash',
  rebase: 'rebase',
  'rebase-merge': 'rebaseMerge'
}

// Azure DevOps thread status enum values used by the REST API.
const THREAD_STATUS = { active: 1, resolved: 2 } as const

type Request = (
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown
) => Promise<unknown>

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`)
  }
  return trimmed
}

async function complete(
  request: Request,
  prPath: string,
  action: Extract<HostedReviewAction, { kind: 'complete' }>
): Promise<void> {
  // Why: Azure DevOps refuses completion unless it names the source commit the reviewer saw.
  const current = await request(prPath, 'GET')
  const pr: RawAzureDevOpsPullRequestDetail | null =
    current && typeof current === 'object' ? current : null
  const commitId = pr?.lastMergeSourceCommit?.commitId
  if (!commitId) {
    throw new Error('Azure DevOps did not report the pull request source commit.')
  }
  await request(prPath, 'PATCH', {
    status: 'completed',
    lastMergeSourceCommit: { commitId },
    completionOptions: {
      mergeStrategy: MERGE_STRATEGIES[action.mergeStrategy],
      deleteSourceBranch: action.deleteSourceBranch,
      ...(action.mergeCommitMessage?.trim()
        ? { mergeCommitMessage: action.mergeCommitMessage.trim() }
        : {})
    }
  })
}

async function dispatch(
  repo: AzureDevOpsRepoRef,
  request: Request,
  prPath: string,
  action: HostedReviewAction
): Promise<void> {
  switch (action.kind) {
    case 'vote': {
      const userId = await getAzureDevOpsCurrentUserId(repo)
      if (!userId) {
        throw new Error('Could not identify the signed-in Azure DevOps user.')
      }
      await request(`${prPath}/reviewers/${encodeURIComponent(userId)}`, 'PUT', {
        vote: azureDevOpsVoteValue(action.vote)
      })
      return
    }
    case 'addReviewer': {
      const reviewerId = await resolveAzureDevOpsIdentityId(repo, action.identity)
      await request(`${prPath}/reviewers/${encodeURIComponent(reviewerId)}`, 'PUT', {
        vote: 0,
        isRequired: action.isRequired === true
      })
      return
    }
    case 'removeReviewer':
      await request(`${prPath}/reviewers/${encodeURIComponent(action.reviewerId)}`, 'DELETE')
      return
    case 'complete':
      await complete(request, prPath, action)
      return
    case 'abandon':
      await request(prPath, 'PATCH', { status: 'abandoned' })
      return
    case 'reopen':
      await request(prPath, 'PATCH', { status: 'active' })
      return
    case 'comment':
      await request(`${prPath}/threads`, 'POST', {
        comments: [
          { parentCommentId: 0, content: requireText(action.content, 'Comment'), commentType: 1 }
        ],
        status: THREAD_STATUS.active
      })
      return
    case 'reply':
      await request(`${prPath}/threads/${action.threadId}/comments`, 'POST', {
        parentCommentId: action.parentCommentId ?? 1,
        content: requireText(action.content, 'Reply'),
        commentType: 1
      })
      return
    case 'setThreadStatus':
      await request(`${prPath}/threads/${action.threadId}`, 'PATCH', {
        status: THREAD_STATUS[action.status]
      })
      return
    case 'edit':
      await request(prPath, 'PATCH', {
        ...(action.title !== undefined ? { title: requireText(action.title, 'Title') } : {}),
        ...(action.description !== undefined ? { description: action.description } : {})
      })
      return
    case 'setDraft':
      await request(prPath, 'PATCH', { isDraft: action.isDraft })
  }
}

export async function performAzureDevOpsPullRequestAction(
  repo: AzureDevOpsRepoRef,
  number: number,
  action: HostedReviewAction
): Promise<HostedReviewActionResult> {
  const baseUrl = resolveAzureDevOpsGitApiBaseUrl(repo)
  const request: Request = (path, method, body) =>
    sendAzureDevOpsRequest(baseUrl, path, { method, ...(body !== undefined ? { body } : {}) })
  try {
    await dispatch(repo, request, pullRequestPath(repo, number), action)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
