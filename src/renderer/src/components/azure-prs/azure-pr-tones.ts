import type { AzureDevOpsPullRequestSituation } from '../../../../shared/azure-devops-pull-request-board'

// Why: every tone is a literal class string so Tailwind can generate it and the design-system gate can read it.
type SituationStyle = {
  badge: string
  dot: string
  tile: string
  order: number
}

const DESTRUCTIVE_BADGE = 'border-destructive/30 bg-destructive/10 text-destructive'
const WARNING_BADGE =
  'border-status-warning-border bg-status-warning-background text-status-warning'
const PRIMARY_BADGE = 'border-primary/30 bg-primary/10 text-primary'
const SUCCESS_BADGE =
  'border-status-success-border bg-status-success-background text-status-success'
const MUTED_BADGE = 'border-border bg-muted text-muted-foreground'

export const SITUATION_STYLE: Record<AzureDevOpsPullRequestSituation, SituationStyle> = {
  conflicts: {
    badge: DESTRUCTIVE_BADGE,
    dot: 'bg-destructive',
    tile: 'text-destructive',
    order: 0
  },
  rejected: {
    badge: DESTRUCTIVE_BADGE,
    dot: 'bg-destructive',
    tile: 'text-destructive',
    order: 1
  },
  build_failed: {
    badge: WARNING_BADGE,
    dot: 'bg-status-warning',
    tile: 'text-status-warning',
    order: 2
  },
  waiting_author: {
    badge: WARNING_BADGE,
    dot: 'bg-status-warning',
    tile: 'text-status-warning',
    order: 3
  },
  pending: {
    badge: PRIMARY_BADGE,
    dot: 'bg-primary',
    tile: 'text-primary',
    order: 4
  },
  approved: {
    badge: SUCCESS_BADGE,
    dot: 'bg-status-success',
    tile: 'text-status-success',
    order: 5
  },
  draft: {
    badge: MUTED_BADGE,
    dot: 'bg-muted-foreground',
    tile: 'text-muted-foreground',
    order: 6
  }
}

export function isAzurePullRequestSituation(
  value: string
): value is AzureDevOpsPullRequestSituation {
  return Object.hasOwn(SITUATION_STYLE, value)
}

// Pending is the fallback so a situation the host adds later still renders.
export function situationStyleOf(situation: string): SituationStyle {
  return isAzurePullRequestSituation(situation)
    ? SITUATION_STYLE[situation]
    : SITUATION_STYLE.pending
}

// Only what blocks the merge gets the emphasized border; if everything stands out, nothing does.
export function isUrgentSituation(situation: string): boolean {
  return situation === 'conflicts' || situation === 'rejected' || situation === 'build_failed'
}

export function voteRingClass(vote: number): string {
  if (vote >= 5) {
    return 'ring-status-success'
  }
  if (vote === -5) {
    return 'ring-status-warning'
  }
  if (vote === -10) {
    return 'ring-destructive'
  }
  return 'ring-border'
}

export function policyToneClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'border-status-success-border text-status-success'
    case 'rejected':
    case 'broken':
      return 'border-destructive/30 text-destructive'
    case 'running':
    case 'queued':
      return 'border-primary/30 text-primary'
    default:
      return 'border-border text-muted-foreground'
  }
}

// Bug stands apart on purpose: it is the only type that means a defect.
export function workItemTypeToneClass(type: string): string {
  switch (type) {
    case 'Bug':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    case 'Product Backlog Item':
    case 'User Story':
      return 'border-primary/30 bg-primary/10 text-primary'
    case 'Feature':
    case 'Epic':
      return 'border-status-warning-border bg-status-warning-background text-status-warning'
    default:
      return 'border-border text-muted-foreground'
  }
}
