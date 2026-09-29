import { useState } from 'react'
import { CheckCircle2, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { HostedReviewThread } from '../../../../../shared/hosted-review-actions'
import type { HostedReviewDetailsState } from './use-hosted-review-details'

function formatTime(value: string): string {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toLocaleString() : ''
}

function CommentComposer(props: {
  placeholder: string
  submitLabel: string
  disabled: boolean
  onSubmit: (content: string) => Promise<boolean>
}): React.JSX.Element {
  const [content, setContent] = useState('')
  return (
    <form
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        void props.onSubmit(content.trim()).then((ok) => ok && setContent(''))
      }}
    >
      <Textarea
        rows={2}
        value={content}
        disabled={props.disabled}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" size="xs" disabled={props.disabled || !content.trim()}>
          {props.submitLabel}
        </Button>
      </div>
    </form>
  )
}

function ThreadView(props: {
  thread: HostedReviewThread
  state: HostedReviewDetailsState
}): React.JSX.Element {
  const { thread, state } = props
  const [replying, setReplying] = useState(false)
  const resolved = thread.status === 'resolved'
  const canResolve = state.details?.capabilities.resolveThreads === true
  const busy = state.pendingAction !== null
  const rootCommentId = thread.comments[0]?.id

  return (
    <li className="space-y-1.5 rounded-md border border-border/60 p-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {resolved ? (
          <CheckCircle2 className="size-3 text-status-success" />
        ) : (
          <CircleDot className="size-3" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {thread.filePath
            ? `${thread.filePath}${thread.line ? `:${thread.line}` : ''}`
            : translate(
                'auto.components.right.sidebar.hostedReviewDetails.generalThread',
                'General'
              )}
        </span>
        {canResolve ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() =>
              void state.run({
                kind: 'setThreadStatus',
                threadId: thread.id,
                status: resolved ? 'active' : 'resolved'
              })
            }
          >
            {resolved
              ? translate(
                  'auto.components.right.sidebar.hostedReviewDetails.reactivate',
                  'Reactivate'
                )
              : translate('auto.components.right.sidebar.hostedReviewDetails.resolve', 'Resolve')}
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {thread.comments.map((comment) => (
          <li key={comment.id} className="text-[12px]">
            <div className="flex gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{comment.author}</span>
              <span>{formatTime(comment.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-foreground">{comment.content}</p>
          </li>
        ))}
      </ul>
      {state.details?.capabilities.comment ? (
        replying ? (
          <CommentComposer
            placeholder={translate(
              'auto.components.right.sidebar.hostedReviewDetails.replyPlaceholder',
              'Reply'
            )}
            submitLabel={translate(
              'auto.components.right.sidebar.hostedReviewDetails.reply',
              'Reply'
            )}
            disabled={busy}
            onSubmit={async (content) => {
              const ok = await state.run({
                kind: 'reply',
                threadId: thread.id,
                content,
                ...(rootCommentId ? { parentCommentId: rootCommentId } : {})
              })
              if (ok) {
                setReplying(false)
              }
              return ok
            }}
          />
        ) : (
          <Button variant="ghost" size="xs" onClick={() => setReplying(true)}>
            {translate('auto.components.right.sidebar.hostedReviewDetails.reply', 'Reply')}
          </Button>
        )
      ) : null}
    </li>
  )
}

export function HostedReviewThreads(props: {
  state: HostedReviewDetailsState
}): React.JSX.Element | null {
  const { details, pendingAction, run } = props.state
  if (!details) {
    return null
  }
  const active = details.threads.filter((thread) => thread.status === 'active')
  const resolved = details.threads.filter((thread) => thread.status === 'resolved')
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {translate('auto.components.right.sidebar.hostedReviewDetails.comments', 'Comments')}
        {` (${active.length})`}
      </h3>
      {details.threads.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {translate(
            'auto.components.right.sidebar.hostedReviewDetails.noComments',
            'No comments yet.'
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {[...active, ...resolved].map((thread) => (
            <ThreadView key={thread.id} thread={thread} state={props.state} />
          ))}
        </ul>
      )}
      {details.capabilities.comment ? (
        <CommentComposer
          placeholder={translate(
            'auto.components.right.sidebar.hostedReviewDetails.commentPlaceholder',
            'Leave a comment'
          )}
          submitLabel={translate(
            'auto.components.right.sidebar.hostedReviewDetails.comment',
            'Comment'
          )}
          disabled={pendingAction !== null}
          onSubmit={(content) => run({ kind: 'comment', content })}
        />
      ) : null}
    </section>
  )
}
