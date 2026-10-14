import type {
  AzureDevOpsBoardIdentity,
  AzureDevOpsBoardPullRequest,
  AzureDevOpsPullRequestBoard,
  AzureDevOpsPullRequestBoardResult,
  AzureDevOpsPullRequestReviewer
} from '../../shared/azure-devops-pull-request-board'
import { mapWithConcurrency } from '../../shared/map-with-concurrency'
import { fetchAzureBoardWorkItemsByIds } from '../azure-boards/work-items-client'
import { getAzureBoardsOrganizationUrl } from '../azure-boards/azure-boards-scope'
import { requestAzureDevOpsJsonAtBase } from './azure-devops-api-request'
import { sendAzureDevOpsRequest } from './azure-devops-mutation-request'
import {
  parsePolicies,
  parseThreads,
  parseWorkItemIds,
  pullRequestSeverity,
  readPullRequestSituation
} from './pull-request-situation'

const IDENTITY_CACHE_MS = 10 * 60_000
const ENRICH_CONCURRENCY = 6
const SUB_REQUEST_TIMEOUT_MS = 15_000
const MS_PER_DAY = 86_400_000

const identityCache = new Map<string, { value: AzureDevOpsBoardIdentity; expiresAt: number }>()
let inFlight: Promise<AzureDevOpsPullRequestBoardResult> | null = null

/** @internal - exposed for tests only */
export function _resetAzureDevOpsPullRequestBoardState(): void {
  identityCache.clear()
  inFlight = null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function pathText(value: unknown, ...keys: string[]): string {
  let current = value
  for (const key of keys) {
    current = asRecord(current)?.[key]
  }
  return text(current)
}

async function readIdentity(organizationUrl: string): Promise<AzureDevOpsBoardIdentity> {
  const cached = identityCache.get(organizationUrl)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }
  // connectionData only answers on a preview api-version.
  const payload = await sendAzureDevOpsRequest(organizationUrl, '/_apis/connectionData', {
    method: 'GET',
    apiVersion: '7.1-preview'
  })
  const user = asRecord(asRecord(payload)?.authenticatedUser)
  const id = text(user?.id)
  if (!id) {
    throw new Error('Azure DevOps did not return the signed-in identity.')
  }
  const displayName = text(user?.providerDisplayName)
  const value: AzureDevOpsBoardIdentity = {
    id,
    displayName,
    email: pathText(user, 'properties', 'Account', '$value') || text(user?.uniqueName)
  }
  identityCache.set(organizationUrl, {
    value,
    expiresAt: Date.now() + IDENTITY_CACHE_MS
  })
  return value
}

function mapReviewers(raw: unknown): AzureDevOpsPullRequestReviewer[] {
  return Array.isArray(raw)
    ? raw.map((entry) => {
        const reviewer = asRecord(entry)
        return {
          id: text(reviewer?.id),
          displayName: text(reviewer?.displayName),
          uniqueName: text(reviewer?.uniqueName),
          vote: typeof reviewer?.vote === 'number' ? reviewer.vote : 0,
          isRequired: reviewer?.isRequired === true,
          isContainer: reviewer?.isContainer === true
        }
      })
    : []
}

function shortRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, '')
}

function ageInDays(creationDate: string): number {
  const created = Date.parse(creationDate)
  return Number.isNaN(created) ? 0 : Math.max(0, Math.floor((Date.now() - created) / MS_PER_DAY))
}

async function enrich(
  organizationUrl: string,
  me: AzureDevOpsBoardIdentity,
  raw: unknown
): Promise<AzureDevOpsBoardPullRequest | null> {
  const pr = asRecord(raw)
  const id = pr?.pullRequestId
  const project = pathText(pr, 'repository', 'project', 'name')
  const repository = pathText(pr, 'repository', 'name')
  if (typeof id !== 'number' || !project || !repository) {
    return null
  }
  const projectId = pathText(pr, 'repository', 'project', 'id')
  const repositoryId = pathText(pr, 'repository', 'id')
  const projectPath = `/${encodeURIComponent(project)}`
  const pullRequestPath = `${projectPath}/_apis/git/repositories/${repositoryId}/pullRequests/${id}`

  // Why: a failed sub-call degrades to null so one flaky endpoint never drops the PR.
  const [policiesPayload, threadsPayload, workItemsPayload] = await Promise.all([
    requestAzureDevOpsJsonAtBase<unknown>(
      organizationUrl,
      `${projectPath}/_apis/policy/evaluations`,
      {
        searchParams: {
          artifactId: `vstfs:///CodeReview/CodeReviewId/${projectId}/${id}`,
          'api-version': '7.1-preview.1'
        },
        timeoutMs: SUB_REQUEST_TIMEOUT_MS
      }
    ),
    requestAzureDevOpsJsonAtBase<unknown>(organizationUrl, `${pullRequestPath}/threads`, {
      timeoutMs: SUB_REQUEST_TIMEOUT_MS
    }),
    requestAzureDevOpsJsonAtBase<unknown>(organizationUrl, `${pullRequestPath}/workitems`, {
      timeoutMs: SUB_REQUEST_TIMEOUT_MS
    })
  ])

  const policies = parsePolicies(policiesPayload)
  const threads = parseThreads(threadsPayload)
  const reviewers = mapReviewers(pr?.reviewers)
  const isDraft = pr?.isDraft === true
  const mergeStatus = text(pr?.mergeStatus)
  const creationDate = text(pr?.creationDate)
  const { situation, signals } = readPullRequestSituation({
    isDraft,
    mergeStatus,
    reviewers,
    policies,
    activeThreads: threads.active
  })

  return {
    id,
    title: text(pr?.title),
    project,
    repository,
    repositoryId,
    sourceBranch: shortRef(text(pr?.sourceRefName)),
    targetBranch: shortRef(text(pr?.targetRefName)),
    createdBy: pathText(pr, 'createdBy', 'displayName'),
    createdByEmail: pathText(pr, 'createdBy', 'uniqueName'),
    creationDate,
    isDraft,
    mergeStatus,
    url: `${organizationUrl}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repository)}/pullrequest/${id}`,
    reviewers,
    policies,
    activeThreads: threads.active,
    totalThreads: threads.total,
    workItemIds: parseWorkItemIds(workItemsPayload),
    isMine: pathText(pr, 'createdBy', 'id') === me.id,
    isReviewer: reviewers.some((reviewer) => reviewer.id === me.id),
    situation,
    signals,
    ageDays: ageInDays(creationDate)
  }
}

async function loadBoard(): Promise<AzureDevOpsPullRequestBoard> {
  const organizationUrl = await getAzureBoardsOrganizationUrl()
  if (!organizationUrl) {
    throw new Error(
      'Set a default Azure DevOps organization in Settings > Integrations to see pull requests.'
    )
  }
  const me = await readIdentity(organizationUrl)
  const payload = await sendAzureDevOpsRequest(organizationUrl, '/_apis/git/pullrequests', {
    method: 'GET',
    searchParams: { 'searchCriteria.status': 'active', $top: 500 }
  })
  const all = asRecord(payload)?.value
  // Why: the org holds everyone's PRs and each kept one costs three more calls.
  const relevant = (Array.isArray(all) ? all : []).filter((entry) => {
    const pr = asRecord(entry)
    return (
      pathText(pr, 'createdBy', 'id') === me.id ||
      (Array.isArray(pr?.reviewers) &&
        pr.reviewers.some((reviewer) => asRecord(reviewer)?.id === me.id))
    )
  })

  const enriched = await mapWithConcurrency(relevant, ENRICH_CONCURRENCY, (entry) =>
    enrich(organizationUrl, me, entry)
  )
  const pullRequests = enriched
    .filter((pr): pr is AzureDevOpsBoardPullRequest => pr !== null)
    .sort(
      (a, b) =>
        pullRequestSeverity(a.situation) - pullRequestSeverity(b.situation) || b.ageDays - a.ageDays
    )

  const ids = [...new Set(pullRequests.flatMap((pr) => pr.workItemIds))].sort((a, b) => a - b)
  // Why: missing work item details degrade to bare ids; they must not fail the PR list.
  const details = await fetchAzureBoardWorkItemsByIds(organizationUrl, ids).catch(() => new Map())
  return {
    identity: me,
    organizationUrl,
    pullRequests,
    workItems: Object.fromEntries([...details].map(([id, item]) => [String(id), item])),
    fetchedAt: Date.now()
  }
}

/** Concurrent callers (several windows polling) share one in-flight load. */
export function getAzureDevOpsPullRequestBoard(): Promise<AzureDevOpsPullRequestBoardResult> {
  if (!inFlight) {
    const run = loadBoard()
      .then((board): AzureDevOpsPullRequestBoardResult => ({ ok: true, board }))
      .catch((error: unknown): AzureDevOpsPullRequestBoardResult => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }))
      .finally(() => {
        inFlight = null
      })
    inFlight = run
  }
  return inFlight
}
