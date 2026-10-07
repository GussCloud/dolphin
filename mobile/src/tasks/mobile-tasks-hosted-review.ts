import { projectRowType } from './mobile-tasks-item-mapping'
import type {
  HostedReviewMergeMethod,
  PendingHostedMerge,
  PendingHostedStateChange,
  PendingProjectGitHubMerge,
  TaskItem
} from './mobile-tasks-project-workspace-types'
import type {
  GitHubAssignableUser,
  GitHubPRReviewSummary,
  GitHubPRReviewerRow,
  GitHubWorkItem
} from './mobile-tasks-provider-detail-types'
import { translateTasks as t } from './tasks-translate'

export function getLinearPriorityLabel(priority: number): string {
  switch (priority) {
    case 0:
      return t('none')
    case 1:
      return t('priorityUrgent')
    case 2:
      return t('priorityHigh')
    case 3:
      return t('priorityMedium')
    case 4:
      return t('priorityLow')
    default:
      return `P${priority}`
  }
}

export function getLinearPriorityRank(priority: number): number {
  return priority === 0 ? 5 : priority
}

export function formatGitHubReviewState(state: string | null | undefined): string {
  switch (state) {
    case 'APPROVED':
      return t('reviewApproved')
    case 'CHANGES_REQUESTED':
      return t('reviewChangesRequested')
    case 'COMMENTED':
      return t('reviewCommented')
    case 'DISMISSED':
      return t('reviewDismissed')
    case 'PENDING':
      return t('reviewPending')
    default:
      return t('reviewReviewed')
  }
}

export function getGitHubReviewerRows(item: {
  reviewRequests?: GitHubAssignableUser[]
  latestReviews?: GitHubPRReviewSummary[]
}): GitHubPRReviewerRow[] {
  const byLogin = new Map<string, GitHubPRReviewerRow>()
  for (const user of item.reviewRequests ?? []) {
    const login = user.login.trim()
    if (!login) {
      continue
    }
    byLogin.set(login.toLowerCase(), {
      login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      stateLabel: t('reviewRequested')
    })
  }
  for (const review of item.latestReviews ?? []) {
    const login = review.login.trim()
    const key = login.toLowerCase()
    if (!login || byLogin.has(key)) {
      continue
    }
    byLogin.set(key, {
      login,
      name: null,
      avatarUrl: review.avatarUrl,
      stateLabel: formatGitHubReviewState(review.state)
    })
  }
  return Array.from(byLogin.values())
}

export function getGitHubReviewSummary(item: {
  reviewDecision?: string | null
  reviewRequests?: GitHubAssignableUser[]
  latestReviews?: GitHubPRReviewSummary[]
}): string {
  if (item.reviewDecision === 'APPROVED') {
    return t('reviewApproved')
  }
  if (item.reviewDecision === 'CHANGES_REQUESTED') {
    return t('reviewChangesRequested')
  }
  const rows = getGitHubReviewerRows(item)
  if (rows.length === 0) {
    return t('noReviewers')
  }
  if (rows.length === 1) {
    return t('reviewerSummaryOne', { login: rows[0]!.login, state: rows[0]!.stateLabel })
  }
  return t('reviewerSummaryMany', { login: rows[0]!.login, count: rows.length - 1 })
}

export function formatGitHubPRDelta(item: GitHubWorkItem): string | null {
  const parts: string[] = []
  if (typeof item.additions === 'number') {
    parts.push(`+${item.additions}`)
  }
  if (typeof item.deletions === 'number') {
    parts.push(`-${item.deletions}`)
  }
  if (typeof item.changedFiles === 'number') {
    parts.push(t('changedFileCount', { count: item.changedFiles }))
  }
  return parts.length > 0 ? parts.join(' ') : null
}

export function hostedBranchSummary(item: TaskItem): { head: string; base: string } | null {
  if (item.provider === 'github' && item.source.type === 'pr') {
    return {
      head: item.source.branchName?.trim() || t('unknownHead'),
      base: item.source.baseRefName?.trim() || t('baseBranchFallback')
    }
  }
  if (item.provider === 'gitlab' && item.source.type === 'mr') {
    return {
      head: item.source.branchName?.trim() || t('unknownHead'),
      base: item.source.baseRefName?.trim() || t('baseBranchFallback')
    }
  }
  return null
}

export function getGitHubMergeLabel(item: GitHubWorkItem): string {
  if (item.mergeable === undefined && item.mergeStateStatus === undefined) {
    return t('merge')
  }
  if (item.state === 'merged') {
    return t('merged')
  }
  if (item.state === 'closed') {
    return t('closed')
  }
  if (item.mergeable === 'CONFLICTING') {
    return t('mergeConflicts')
  }
  if (item.mergeStateStatus === 'BEHIND') {
    return t('mergeBehind')
  }
  if (item.mergeStateStatus === 'BLOCKED') {
    return t('mergeBlocked')
  }
  if (item.mergeable === 'MERGEABLE' || item.mergeStateStatus === 'CLEAN') {
    return t('mergeAble')
  }
  return t('unknown')
}

export function getHostedReviewMergeMethodLabel(method: HostedReviewMergeMethod): string {
  if (method === 'squash') {
    return t('mergeMethodSquash')
  }
  if (method === 'rebase') {
    return t('mergeMethodRebase')
  }
  return t('mergeMethodMergeCommit')
}

export function getHostedMergeConfirmMessage(pending: PendingHostedMerge): string {
  const number = pending.item.source.number
  if (pending.item.provider === 'gitlab') {
    if (pending.method === 'squash') {
      return t('mergeConfirmSquashMr', { number })
    }
    return pending.method === 'rebase'
      ? t('mergeConfirmRebaseMr', { number })
      : t('mergeConfirmMergeMr', { number })
  }
  if (pending.method === 'squash') {
    return t('mergeConfirmSquashPr', { number })
  }
  return pending.method === 'rebase'
    ? t('mergeConfirmRebasePr', { number })
    : t('mergeConfirmMergePr', { number })
}

export function getProjectGitHubMergeConfirmMessage(pending: PendingProjectGitHubMerge): string {
  const number = String(pending.row.content.number)
  if (pending.method === 'squash') {
    return t('mergeConfirmSquashPr', { number })
  }
  return pending.method === 'rebase'
    ? t('mergeConfirmRebasePr', { number })
    : t('mergeConfirmMergePr', { number })
}

type HostedStateChangeTarget = 'pr' | 'mr' | 'issue'

function hostedStateChangeTarget(pending: PendingHostedStateChange): {
  target: HostedStateChangeTarget
  number: string
} {
  if (pending.source === 'project') {
    return {
      target: projectRowType(pending.row) === 'pr' ? 'pr' : 'issue',
      number: String(pending.row.content.number)
    }
  }
  const number = String(pending.item.source.number)
  if (pending.item.provider === 'gitlab') {
    return { target: pending.item.source.type === 'mr' ? 'mr' : 'issue', number }
  }
  return { target: pending.item.source.type === 'pr' ? 'pr' : 'issue', number }
}

export function getHostedStateConfirmTitle(pending: PendingHostedStateChange): string {
  const { target } = hostedStateChangeTarget(pending)
  if (pending.nextState === 'closed') {
    return target === 'pr'
      ? t('closePullRequestTitle')
      : target === 'mr'
        ? t('closeMergeRequestTitle')
        : t('closeIssueTitle')
  }
  return target === 'pr'
    ? t('reopenPullRequestTitle')
    : target === 'mr'
      ? t('reopenMergeRequestTitle')
      : t('reopenIssueTitle')
}

export function getHostedStateConfirmMessage(pending: PendingHostedStateChange): string {
  const { target, number } = hostedStateChangeTarget(pending)
  if (pending.nextState === 'closed') {
    return target === 'pr'
      ? t('closePrMessage', { number })
      : target === 'mr'
        ? t('closeMrMessage', { number })
        : t('closeIssueMessage', { number })
  }
  return target === 'pr'
    ? t('reopenPrMessage', { number })
    : target === 'mr'
      ? t('reopenMrMessage', { number })
      : t('reopenIssueMessage', { number })
}

export function getHostedStateConfirmLabel(pending: PendingHostedStateChange): string {
  const { target } = hostedStateChangeTarget(pending)
  if (pending.nextState === 'closed') {
    return target === 'pr'
      ? t('closePrLabel')
      : target === 'mr'
        ? t('closeMrLabel')
        : t('closeIssueLabel')
  }
  return target === 'pr'
    ? t('reopenPrLabel')
    : target === 'mr'
      ? t('reopenMrLabel')
      : t('reopenIssueLabel')
}
