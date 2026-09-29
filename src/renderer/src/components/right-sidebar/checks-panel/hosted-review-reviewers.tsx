import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type {
  HostedReviewReviewer,
  HostedReviewVote
} from '../../../../../shared/hosted-review-actions'
import type { HostedReviewDetailsState } from './use-hosted-review-details'

export function hostedReviewVoteLabel(vote: HostedReviewVote): string {
  switch (vote) {
    case 'approved':
      return translate('auto.components.right.sidebar.hostedReviewDetails.voteApproved', 'Approved')
    case 'approved-with-suggestions':
      return translate(
        'auto.components.right.sidebar.hostedReviewDetails.voteApprovedWithSuggestions',
        'Approved with suggestions'
      )
    case 'waiting-for-author':
      return translate(
        'auto.components.right.sidebar.hostedReviewDetails.voteWaiting',
        'Waiting for author'
      )
    case 'rejected':
      return translate('auto.components.right.sidebar.hostedReviewDetails.voteRejected', 'Rejected')
    case 'no-vote':
      return translate('auto.components.right.sidebar.hostedReviewDetails.voteNone', 'No vote')
  }
}

const VOTE_TONE: Record<HostedReviewVote, string> = {
  approved: 'text-status-success',
  'approved-with-suggestions': 'text-status-success',
  'waiting-for-author': 'text-amber-600 dark:text-amber-400',
  rejected: 'text-destructive',
  'no-vote': 'text-muted-foreground'
}

function ReviewerRow(props: {
  reviewer: HostedReviewReviewer
  canRemove: boolean
  onRemove: () => void
}): React.JSX.Element {
  const { reviewer } = props
  return (
    <li className="group/reviewer flex items-center gap-2 text-[12px]">
      <span className="min-w-0 flex-1 truncate text-foreground" title={reviewer.uniqueName ?? ''}>
        {reviewer.displayName}
        {reviewer.isRequired ? (
          <span className="ml-1 text-muted-foreground">
            {translate('auto.components.right.sidebar.hostedReviewDetails.required', '(required)')}
          </span>
        ) : null}
      </span>
      <span className={VOTE_TONE[reviewer.vote]}>{hostedReviewVoteLabel(reviewer.vote)}</span>
      {props.canRemove ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate(
            'auto.components.right.sidebar.hostedReviewDetails.removeReviewer',
            'Remove {{value0}}',
            { value0: reviewer.displayName }
          )}
          onClick={props.onRemove}
        >
          <X />
        </Button>
      ) : null}
    </li>
  )
}

export function HostedReviewReviewers(props: {
  state: HostedReviewDetailsState
}): React.JSX.Element | null {
  const { details, pendingAction, run } = props.state
  const [identity, setIdentity] = useState('')
  if (!details) {
    return null
  }
  const editable = details.capabilities.editReviewers
  const busy = pendingAction === 'addReviewer' || pendingAction === 'removeReviewer'

  const add = async (): Promise<void> => {
    if (await run({ kind: 'addReviewer', identity: identity.trim() })) {
      setIdentity('')
    }
  }

  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {translate('auto.components.right.sidebar.hostedReviewDetails.reviewers', 'Reviewers')}
      </h3>
      {details.reviewers.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {translate(
            'auto.components.right.sidebar.hostedReviewDetails.noReviewers',
            'No reviewers yet.'
          )}
        </p>
      ) : (
        <ul className="space-y-1">
          {details.reviewers.map((reviewer) => (
            <ReviewerRow
              key={reviewer.id}
              reviewer={reviewer}
              canRemove={editable && !busy}
              onRemove={() => void run({ kind: 'removeReviewer', reviewerId: reviewer.id })}
            />
          ))}
        </ul>
      )}
      {editable ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <Input
            className="h-7 flex-1"
            value={identity}
            disabled={busy}
            placeholder={translate(
              'auto.components.right.sidebar.hostedReviewDetails.addReviewerPlaceholder',
              'Add reviewer by email'
            )}
            aria-label={translate(
              'auto.components.right.sidebar.hostedReviewDetails.addReviewerLabel',
              'Reviewer email or name'
            )}
            onChange={(event) => setIdentity(event.target.value)}
          />
          <Button type="submit" variant="outline" size="xs" disabled={busy || !identity.trim()}>
            <Plus />
            {translate('auto.components.right.sidebar.hostedReviewDetails.add', 'Add')}
          </Button>
        </form>
      ) : null}
    </section>
  )
}
