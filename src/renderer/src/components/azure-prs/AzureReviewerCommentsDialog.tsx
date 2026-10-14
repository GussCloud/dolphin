import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  LoaderCircle,
  MessageSquare,
  Users
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { getAzureDevOpsPullRequestComments } from '@/lib/azure-devops-host-client'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type {
  AzureDevOpsBoardPullRequest,
  AzureDevOpsPullRequestComment,
  AzureDevOpsPullRequestReviewer
} from '../../../../shared/azure-devops-pull-request-board'
import { AzurePullRequestChip } from './AzurePullRequestChip'
import { AzureReviewerAvatars, reviewerName } from './AzureReviewerAvatars'
import { isCommentFromReviewer } from './azure-pr-comment-author'
import { commentDateLabel, threadStatusLabel, voteLabel } from './azure-pr-labels'
import { threadStatusToneClass } from './azure-pr-tones'

type CommentsState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; comments: AzureDevOpsPullRequestComment[] }

function CommentRow({ comment }: { comment: AzureDevOpsPullRequestComment }): React.JSX.Element {
  const location = comment.filePath
    ? `${comment.filePath}${comment.line ? `:${comment.line}` : ''}`
    : null
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {commentDateLabel(comment.published)}
        </span>
        <AzurePullRequestChip
          className={threadStatusToneClass(comment.threadStatus)}
          title={translate('auto.components.azurePrs.comments.thread', 'Thread {{value0}}', {
            value0: comment.threadId
          })}
        >
          {threadStatusLabel(comment.threadStatus)}
        </AzurePullRequestChip>
        {comment.isReply ? (
          <AzurePullRequestChip>
            {translate('auto.components.azurePrs.comments.reply', 'reply')}
          </AzurePullRequestChip>
        ) : null}
        {location ? (
          <span
            className="ml-auto inline-flex min-w-0 items-center gap-1 font-mono text-[10px] text-muted-foreground"
            title={location}
          >
            <FileText className="size-3 shrink-0" />
            <span className="truncate">
              {comment.filePath?.split('/').pop()}
              {comment.line ? `:${comment.line}` : ''}
            </span>
          </span>
        ) : null}
      </div>
      {/* Why: plain text — Azure returns markdown, and rendering third-party HTML in a window holding the user's credentials is an XSS door. */}
      <p className="whitespace-pre-wrap text-xs leading-relaxed">{comment.content}</p>
    </div>
  )
}

export function AzureReviewerCommentsDialog({
  pr,
  reviewer,
  onReviewerChange,
  onClose
}: {
  pr: AzureDevOpsBoardPullRequest
  reviewer: AzureDevOpsPullRequestReviewer
  onReviewerChange: (reviewer: AzureDevOpsPullRequestReviewer) => void
  onClose: () => void
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [state, setState] = useState<CommentsState>({ status: 'loading' })

  // Why: one read per opened PR — every reviewer's comments arrive together, so switching reviewer stays local.
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    void getAzureDevOpsPullRequestComments(settings, {
      project: pr.project,
      repositoryId: pr.repositoryId,
      pullRequestId: pr.id
    }).then((result) => {
      if (alive) {
        setState(
          result.ok
            ? { status: 'ready', comments: result.comments }
            : { status: 'error', error: result.error }
        )
      }
    })
    return () => {
      alive = false
    }
  }, [settings, pr.project, pr.repositoryId, pr.id])

  const mine = useMemo(
    () =>
      state.status === 'ready'
        ? state.comments.filter((comment) => isCommentFromReviewer(comment, reviewer))
        : [],
    [state, reviewer]
  )
  const name = reviewerName(reviewer.displayName)

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <span className="truncate">{name}</span>
              {reviewer.isContainer ? (
                <AzurePullRequestChip>
                  <Users className="size-3" />
                  {translate('auto.components.azurePrs.comments.group', 'group')}
                </AzurePullRequestChip>
              ) : null}
              <span className="text-xs font-normal text-muted-foreground">
                {voteLabel(reviewer.vote)}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-1.5">
              <span className="truncate">
                !{pr.id} · {pr.title}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                onClick={() => void window.api.shell.openUrl(pr.url)}
                title={translate(
                  'auto.components.azurePrs.comments.openPr',
                  'Open the PR in Azure DevOps'
                )}
              >
                <ExternalLink />
              </Button>
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Why: the avatars repeat here to reach reviewers hidden behind the card's "+N". */}
        {pr.reviewers.length > 1 ? (
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="text-[11px] text-muted-foreground">
              {translate('auto.components.azurePrs.comments.reviewer', 'Reviewer:')}
            </span>
            <AzureReviewerAvatars reviewers={pr.reviewers} onSelect={onReviewerChange} />
          </div>
        ) : null}

        <div className="max-h-[60vh] min-h-32 space-y-2 overflow-y-auto scrollbar-sleek pr-1">
          {state.status === 'loading' ? (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {translate('auto.components.azurePrs.comments.loading', 'Loading comments…')}
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">
                  {translate(
                    'auto.components.azurePrs.comments.error',
                    'Could not read the comments'
                  )}
                </p>
                <pre className="whitespace-pre-wrap font-mono opacity-80">{state.error}</pre>
              </div>
            </div>
          ) : null}

          {state.status === 'ready' && mine.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 size-5 opacity-40" />
              {reviewer.isContainer
                ? translate(
                    'auto.components.azurePrs.comments.emptyGroup',
                    'A group does not comment — a person does. Check each round avatar.'
                  )
                : translate(
                    'auto.components.azurePrs.comments.empty',
                    '{{value0}} has not commented on this PR.',
                    { value0: name }
                  )}
            </div>
          ) : null}

          {mine.map((comment) => (
            <CommentRow key={`${comment.threadId}-${comment.id}`} comment={comment} />
          ))}
        </div>

        {mine.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {translate(
              'auto.components.azurePrs.comments.count',
              '{{value0}} comment(s), newest first.',
              { value0: mine.length }
            )}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
