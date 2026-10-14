import type {
  AzureDevOpsPullRequestComment,
  AzureDevOpsPullRequestCommentsArgs,
  AzureDevOpsPullRequestCommentsResult
} from '../../shared/azure-devops-pull-request-board'
import { getAzureBoardsOrganizationUrl } from '../azure-boards/azure-boards-scope'
import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function lineOf(position: unknown): number | null {
  return integer(asRecord(position)?.line)
}

// Why: an unreadable stamp sorts last so it can never pass for the newest comment.
function publishedAt(published: string): number {
  const time = Date.parse(published)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/** Flattens the threads payload into human comments, newest first. */
export function parsePullRequestComments(payload: unknown): AzureDevOpsPullRequestComment[] {
  const threads = asRecord(payload)?.value
  const out: AzureDevOpsPullRequestComment[] = []
  for (const rawThread of Array.isArray(threads) ? threads : []) {
    const thread = asRecord(rawThread)
    if (thread?.isDeleted === true) {
      continue
    }
    const threadId = integer(thread?.id) ?? 0
    const threadStatus = text(thread?.status) || 'unknown'
    const context = asRecord(thread?.threadContext)
    const filePath = text(context?.filePath) || null
    // A comment on a removed line only has `leftFileStart`.
    const line = lineOf(context?.rightFileStart) ?? lineOf(context?.leftFileStart)
    const comments = thread?.comments
    for (const rawComment of Array.isArray(comments) ? comments : []) {
      const comment = asRecord(rawComment)
      if (comment?.commentType === 'system' || comment?.isDeleted === true) {
        continue
      }
      const content = text(comment?.content).trim()
      if (!content) {
        continue
      }
      const author = asRecord(comment?.author)
      out.push({
        id: integer(comment?.id) ?? 0,
        threadId,
        authorId: text(author?.id),
        authorName: text(author?.displayName),
        authorEmail: text(author?.uniqueName),
        content,
        published: text(comment?.publishedDate),
        threadStatus,
        filePath,
        line,
        isReply: (integer(comment?.parentCommentId) ?? 0) > 0
      })
    }
  }
  return out.sort((a, b) => {
    const left = publishedAt(a.published)
    const right = publishedAt(b.published)
    // Why: -Infinity minus -Infinity is NaN, which would make a subtraction comparator inconsistent.
    return left === right ? 0 : right > left ? 1 : -1
  })
}

export function readPullRequestCommentsArgs(
  value: unknown
): AzureDevOpsPullRequestCommentsArgs | null {
  const args = asRecord(value)
  const project = args?.project
  const repositoryId = args?.repositoryId
  const pullRequestId = args?.pullRequestId
  if (
    typeof project !== 'string' ||
    !project ||
    typeof repositoryId !== 'string' ||
    !repositoryId ||
    typeof pullRequestId !== 'number' ||
    !Number.isInteger(pullRequestId) ||
    pullRequestId <= 0
  ) {
    return null
  }
  return { project, repositoryId, pullRequestId }
}

export async function getAzureDevOpsPullRequestComments(
  args: unknown
): Promise<AzureDevOpsPullRequestCommentsResult> {
  const valid = readPullRequestCommentsArgs(args)
  if (!valid) {
    return { ok: false, error: 'Invalid pull request reference.' }
  }
  try {
    const organizationUrl = await getAzureBoardsOrganizationUrl()
    if (!organizationUrl) {
      return {
        ok: false,
        error: 'Set a default Azure DevOps organization in Settings > Integrations.'
      }
    }
    const payload = await sendAzureDevOpsRequest(
      organizationUrl,
      `/${encodeURIComponent(valid.project)}/_apis/git/repositories/${encodeURIComponent(valid.repositoryId)}/pullRequests/${valid.pullRequestId}/threads`,
      { method: 'GET', apiVersion: '7.1' }
    )
    return { ok: true, comments: parsePullRequestComments(payload) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
