import type {
  AzureDevOpsPullRequestPolicy,
  AzureDevOpsPullRequestReviewer,
  AzureDevOpsPullRequestSignal,
  AzureDevOpsPullRequestSituation
} from '../../shared/azure-devops-pull-request-board'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : null
}

function listOf(payload: unknown): unknown[] {
  const value = asRecord(payload)?.value
  return Array.isArray(value) ? value : []
}

export function parsePolicies(payload: unknown): AzureDevOpsPullRequestPolicy[] {
  return listOf(payload).map((entry) => {
    const evaluation = asRecord(entry)
    const configuration = asRecord(evaluation?.configuration)
    const typeName = asRecord(configuration?.type)?.displayName
    const settingsName = asRecord(configuration?.settings)?.displayName
    // The settings name is what developers recognise; the type name is generic ("Build").
    const name =
      (typeof settingsName === 'string' && settingsName) ||
      (typeof typeName === 'string' && typeName) ||
      'Policy'
    return {
      name,
      status: typeof evaluation?.status === 'string' ? evaluation.status : 'unknown',
      isBlocking: configuration?.isBlocking === true
    }
  })
}

/** Counts human threads only; `system` threads are Azure narrating votes and policies. */
export function parseThreads(payload: unknown): {
  active: number
  total: number
} {
  const human = listOf(payload).filter((entry) => {
    const thread = asRecord(entry)
    const comments = thread?.comments
    return (
      thread?.isDeleted !== true &&
      Array.isArray(comments) &&
      comments.some((comment) => asRecord(comment)?.commentType !== 'system')
    )
  })
  const active = human.filter((entry) => {
    const status = asRecord(entry)?.status
    return status === 'active' || status === 'pending'
  }).length
  return { active, total: human.length }
}

export function parseWorkItemIds(payload: unknown): number[] {
  return listOf(payload).flatMap((entry) => {
    const id = asRecord(entry)?.id
    const parsed = typeof id === 'string' ? Number.parseInt(id, 10) : Number.NaN
    return Number.isNaN(parsed) ? [] : [parsed]
  })
}

export function readPullRequestSituation(input: {
  isDraft: boolean
  mergeStatus: string
  reviewers: readonly AzureDevOpsPullRequestReviewer[]
  policies: readonly AzureDevOpsPullRequestPolicy[]
  activeThreads: number
}): {
  situation: AzureDevOpsPullRequestSituation
  signals: AzureDevOpsPullRequestSignal[]
} {
  const { isDraft, mergeStatus, reviewers, policies, activeThreads } = input
  const signals: AzureDevOpsPullRequestSignal[] = []

  const rejected = reviewers.filter((r) => r.vote === -10).length
  const waiting = reviewers.filter((r) => r.vote === -5).length

  // The approver group releases the merge; a lone person's approval does not replace it.
  // Without any group among the reviewers, people count, or the PR would stay pending forever.
  const hasGroups = reviewers.some((r) => r.isContainer)
  const groupsApproved = reviewers.filter((r) => r.isContainer && r.vote >= 5).length
  const peopleApproved = reviewers.filter((r) => !r.isContainer && r.vote >= 5).length
  const approved = hasGroups ? groupsApproved : peopleApproved

  const failedPolicies = policies.filter((p) => p.status === 'rejected' || p.status === 'broken')
  const buildFailed = failedPolicies.length > 0
  const buildRunning = policies.some((p) => p.status === 'running' || p.status === 'queued')
  const blockingPending = policies.some(
    (p) => p.isBlocking && p.status !== 'approved' && p.status !== 'notApplicable'
  )

  if (mergeStatus === 'conflicts') {
    signals.push({ kind: 'conflicts' })
  }
  if (rejected > 0) {
    signals.push({ kind: 'rejected', count: rejected })
  }
  if (waiting > 0) {
    signals.push({ kind: 'waiting-author', count: waiting })
  }
  if (buildFailed) {
    signals.push({
      kind: 'policy-failed',
      names: failedPolicies.map((p) => p.name)
    })
  }
  if (activeThreads > 0) {
    signals.push({ kind: 'unresolved-threads', count: activeThreads })
  }
  if (buildRunning) {
    signals.push({ kind: 'validation-running' })
  }
  if (approved > 0) {
    signals.push({ kind: 'approvals', count: approved })
  }
  // Explains why a PR someone already approved still reads as pending.
  if (hasGroups && groupsApproved === 0 && peopleApproved > 0) {
    signals.push({
      kind: 'person-approvals-missing-group',
      count: peopleApproved
    })
  }

  // Order is deliberate: what blocks the merge comes before what only delays it.
  let situation: AzureDevOpsPullRequestSituation
  if (isDraft) {
    situation = 'draft'
  } else if (mergeStatus === 'conflicts') {
    situation = 'conflicts'
  } else if (rejected > 0) {
    situation = 'rejected'
  } else if (buildFailed) {
    situation = 'build_failed'
  } else if (waiting > 0 || activeThreads > 0) {
    situation = 'waiting_author'
  } else if (approved > 0 && !blockingPending) {
    situation = 'approved'
  } else {
    // Deliberate fallback: an unknown Azure state reads as pending, the honest default.
    situation = 'pending'
  }

  if (signals.length === 0) {
    signals.push({ kind: 'nothing-pending' })
  }
  return { situation, signals }
}

const SEVERITY: Record<AzureDevOpsPullRequestSituation, number> = {
  conflicts: 0,
  rejected: 1,
  build_failed: 2,
  waiting_author: 3,
  pending: 4,
  approved: 5,
  draft: 6
}

export function pullRequestSeverity(situation: AzureDevOpsPullRequestSituation): number {
  return SEVERITY[situation]
}
