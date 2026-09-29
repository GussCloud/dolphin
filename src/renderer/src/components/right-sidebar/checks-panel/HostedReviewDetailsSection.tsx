import { useState } from 'react'
import { ChevronDown, LoaderCircle, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../../shared/repo-types'
import type { HostedReviewInfo } from '../../../../../shared/hosted-review'
import type { HostedReviewVote } from '../../../../../shared/hosted-review-actions'
import { HostedReviewCompleteDialog } from './hosted-review-complete-dialog'
import { HostedReviewReviewers, hostedReviewVoteLabel } from './hosted-review-reviewers'
import { HostedReviewThreads } from './hosted-review-threads'
import { useHostedReviewDetails, type HostedReviewDetailsState } from './use-hosted-review-details'

const VOTES: HostedReviewVote[] = [
  'approved',
  'approved-with-suggestions',
  'waiting-for-author',
  'rejected',
  'no-vote'
]

function ActionBar(props: { state: HostedReviewDetailsState }): React.JSX.Element | null {
  const { details, pendingAction, run } = props.state
  const [completeOpen, setCompleteOpen] = useState(false)
  if (!details) {
    return null
  }
  const { capabilities } = details
  const busy = pendingAction !== null
  const myVote = details.reviewers.find((reviewer) => reviewer.isCurrentUser)?.vote ?? 'no-vote'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {capabilities.vote ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xs" disabled={busy}>
              {myVote === 'no-vote'
                ? translate('auto.components.right.sidebar.hostedReviewDetails.vote', 'Vote')
                : hostedReviewVoteLabel(myVote)}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {VOTES.map((vote) => (
              <DropdownMenuItem key={vote} onSelect={() => void run({ kind: 'vote', vote })}>
                {vote === 'no-vote'
                  ? translate(
                      'auto.components.right.sidebar.hostedReviewDetails.resetVote',
                      'Reset vote'
                    )
                  : hostedReviewVoteLabel(vote)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {capabilities.complete ? (
        <Button size="xs" disabled={busy} onClick={() => setCompleteOpen(true)}>
          {translate('auto.components.right.sidebar.hostedReviewDetails.complete', 'Complete')}
        </Button>
      ) : null}
      {capabilities.toggleDraft ? (
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => void run({ kind: 'setDraft', isDraft: !details.isDraft })}
        >
          {details.isDraft
            ? translate('auto.components.right.sidebar.hostedReviewDetails.publish', 'Publish')
            : translate(
                'auto.components.right.sidebar.hostedReviewDetails.markDraft',
                'Mark as draft'
              )}
        </Button>
      ) : null}
      {capabilities.abandon ? (
        <Button
          variant="ghost"
          size="xs"
          disabled={busy}
          onClick={() => void run({ kind: 'abandon' })}
        >
          {translate('auto.components.right.sidebar.hostedReviewDetails.abandon', 'Abandon')}
        </Button>
      ) : null}
      {capabilities.reopen ? (
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => void run({ kind: 'reopen' })}
        >
          {translate(
            'auto.components.right.sidebar.hostedReviewDetails.reactivatePr',
            'Reactivate'
          )}
        </Button>
      ) : null}
      {busy ? <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" /> : null}
      {completeOpen ? (
        <HostedReviewCompleteDialog
          open
          strategies={capabilities.mergeStrategies}
          busy={busy}
          onOpenChange={setCompleteOpen}
          onComplete={(options) =>
            void run({ kind: 'complete', ...options }).then((ok) => ok && setCompleteOpen(false))
          }
        />
      ) : null}
    </div>
  )
}

function Description(props: { state: HostedReviewDetailsState }): React.JSX.Element | null {
  const { details, pendingAction, run } = props.state
  const [draft, setDraft] = useState<string | null>(null)
  if (!details) {
    return null
  }
  if (draft !== null) {
    return (
      <form
        className="space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          void run({ kind: 'edit', description: draft }).then((ok) => ok && setDraft(null))
        }}
      >
        <Textarea
          rows={5}
          value={draft}
          aria-label={translate(
            'auto.components.right.sidebar.hostedReviewDetails.description',
            'Description'
          )}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={() => setDraft(null)}>
            {translate('auto.components.right.sidebar.hostedReviewDetails.cancel', 'Cancel')}
          </Button>
          <Button type="submit" size="xs" disabled={pendingAction !== null}>
            {translate('auto.components.right.sidebar.hostedReviewDetails.save', 'Save')}
          </Button>
        </div>
      </form>
    )
  }
  return (
    <div className="group/description flex items-start gap-1.5">
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[12px] text-muted-foreground">
        {details.description.trim() ||
          translate(
            'auto.components.right.sidebar.hostedReviewDetails.noDescription',
            'No description.'
          )}
      </p>
      {details.capabilities.edit ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={translate(
            'auto.components.right.sidebar.hostedReviewDetails.editDescription',
            'Edit description'
          )}
          onClick={() => setDraft(details.description)}
        >
          <Pencil />
        </Button>
      ) : null}
    </div>
  )
}

/** Provider-generic review body, rendered from the host's capability flags. */
export function HostedReviewDetailsSection(props: {
  review: HostedReviewInfo
  repo: Repo
  onRefreshReview: () => Promise<void>
}): React.JSX.Element {
  const state = useHostedReviewDetails(props.repo, props.review, props.onRefreshReview)
  if (!state.details) {
    return (
      <p className="text-[12px] text-muted-foreground">
        {state.loading
          ? translate(
              'auto.components.right.sidebar.hostedReviewDetails.loading',
              'Loading review details…'
            )
          : (state.error ??
            translate(
              'auto.components.right.sidebar.hostedReviewDetails.unavailable',
              'Review details are unavailable.'
            ))}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        {`${state.details.sourceBranch} → ${state.details.targetBranch}`}
        {state.details.author ? ` · ${state.details.author}` : ''}
      </p>
      {state.details.hasConflicts ? (
        <p className="text-[12px] text-destructive">
          {translate(
            'auto.components.right.sidebar.hostedReviewDetails.conflicts',
            'This pull request has merge conflicts.'
          )}
        </p>
      ) : null}
      <ActionBar state={state} />
      <Description state={state} />
      <HostedReviewReviewers state={state} />
      <HostedReviewThreads state={state} />
    </div>
  )
}
