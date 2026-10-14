import { Users } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AzureDevOpsPullRequestReviewer } from '../../../../shared/azure-devops-pull-request-board'
import { voteLabel } from './azure-pr-labels'
import { voteRingClass } from './azure-pr-tones'
import { useAzureReviewerAvatar } from './azure-reviewer-avatar-image'

const MAX_VISIBLE = 6

// `[TEAM FOUNDATION]\SETUP - Approvers` -> `SETUP - Approvers`.
export function reviewerName(name: string): string {
  return name.includes('\\') ? (name.split('\\').pop() ?? name) : name
}

function initials(name: string): string {
  const words = reviewerName(name)
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) {
    return '?'
  }
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

function ReviewerAvatar({
  reviewer,
  onSelect
}: {
  reviewer: AzureDevOpsPullRequestReviewer
  onSelect?: (reviewer: AzureDevOpsPullRequestReviewer) => void
}): React.JSX.Element {
  const name = reviewerName(reviewer.displayName)
  const group = reviewer.isContainer
  const photo = useAzureReviewerAvatar(reviewer.imageUrl)
  const face = photo ? (
    <img src={photo} alt={name} className="size-full object-cover" />
  ) : group ? (
    <Users className="size-3" />
  ) : (
    initials(name)
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Why: a square group, a round person — the shape tells them apart without a legend. */}
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(reviewer)}
            className={cn(
              'inline-flex size-6 cursor-pointer items-center justify-center overflow-hidden bg-muted text-[9px] font-medium text-muted-foreground outline-none ring-2 ring-offset-1 ring-offset-card hover:z-10 focus-visible:z-10 focus-visible:ring-ring',
              voteRingClass(reviewer.vote),
              group ? 'rounded-md' : 'rounded-full'
            )}
          >
            {face}
          </button>
        ) : (
          // Why: without a handler the click passes through to the card, which selects the PR in selection mode.
          <span
            className={cn(
              'inline-flex size-6 cursor-default items-center justify-center overflow-hidden bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-offset-1 ring-offset-card',
              voteRingClass(reviewer.vote),
              group ? 'rounded-md' : 'rounded-full'
            )}
          >
            {face}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-medium">{name}</span>
        {group ? ` ${translate('auto.components.azurePrs.reviewer.group', '(group)')}` : ''} —{' '}
        {voteLabel(reviewer.vote)}
        {reviewer.isRequired
          ? ` · ${translate('auto.components.azurePrs.reviewer.required', 'required')}`
          : ''}
        {onSelect ? (
          <span className="block">
            {translate('auto.components.azurePrs.reviewer.viewComments', 'Click to see comments')}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function AzureReviewerAvatars({
  reviewers,
  onSelect
}: {
  reviewers: AzureDevOpsPullRequestReviewer[]
  // When set, each avatar becomes a button.
  onSelect?: (reviewer: AzureDevOpsPullRequestReviewer) => void
}): React.JSX.Element | null {
  if (reviewers.length === 0) {
    return null
  }
  // Groups first: they are the approvers that usually gate the merge, and one stands for several people.
  const ordered = [...reviewers].sort((a, b) => Number(b.isContainer) - Number(a.isContainer))
  const visible = ordered.slice(0, MAX_VISIBLE)
  const rest = ordered.slice(MAX_VISIBLE)

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-1.5">
        {visible.map((reviewer) => (
          <ReviewerAvatar
            key={reviewer.id || reviewer.uniqueName || reviewer.displayName}
            reviewer={reviewer}
            onSelect={onSelect}
          />
        ))}
      </div>
      {rest.length > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{rest.length}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {rest.map((reviewer) => reviewerName(reviewer.displayName)).join(', ')}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
