import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ExternalLink,
  FolderGit2,
  MessageSquare,
  ShieldCheck,
  Ticket
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type {
  AzureDevOpsBoardPullRequest,
  AzureDevOpsPullRequestReviewer
} from '../../../../shared/azure-devops-pull-request-board'
import { AzurePullRequestChip } from './AzurePullRequestChip'
import { AzureReviewerAvatars } from './AzureReviewerAvatars'
import { AzureReviewerCommentsDialog } from './AzureReviewerCommentsDialog'
import { ageLabel, policyLabel, signalText, situationLabel } from './azure-pr-labels'
import { isUrgentSituation, policyToneClass, situationStyleOf } from './azure-pr-tones'

export function AzurePullRequestCard({
  pr,
  groupedUnder,
  selecting,
  checked,
  onToggle
}: {
  pr: AzureDevOpsBoardPullRequest
  // Work item the card is rendered under; its badge is dropped since the group header already says it.
  groupedUnder: number | null
  selecting: boolean
  checked: boolean
  onToggle: () => void
}): React.JSX.Element {
  const style = situationStyleOf(pr.situation)
  const label = situationLabel(pr.situation)
  const [commentsReviewer, setCommentsReviewer] = useState<AzureDevOpsPullRequestReviewer | null>(
    null
  )
  const openPullRequest = (): void => void window.api.shell.openUrl(pr.url)

  return (
    // Why: in selection mode the whole card is the click target and the two browser-opening controls step aside.
    <div
      onClick={selecting ? onToggle : undefined}
      onKeyDown={
        selecting
          ? (event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                // Space scrolls the page by default, which would scroll the list behind the card.
                event.preventDefault()
                onToggle()
              }
            }
          : undefined
      }
      tabIndex={selecting ? 0 : undefined}
      role={selecting ? 'checkbox' : undefined}
      aria-checked={selecting ? checked : undefined}
      className={cn(
        'relative flex h-full flex-col gap-2.5 overflow-hidden rounded-xl border border-border/50 bg-card/40 p-3 text-card-foreground transition-colors hover:border-foreground/25',
        isUrgentSituation(pr.situation) && 'border-destructive/40',
        selecting &&
          'cursor-pointer select-none outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selecting && checked && 'border-primary/60 bg-primary/5'
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('size-2 shrink-0 rounded-full', style.dot)} />
        <span
          className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground"
          title={`${pr.project} / ${pr.repository}`}
        >
          <FolderGit2 className="size-3 shrink-0 opacity-70" />
          <span className="truncate">{pr.repository}</span>
        </span>
        {selecting ? (
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
              checked ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/30'
            )}
          >
            {checked ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            onClick={openPullRequest}
            aria-label={translate(
              'auto.components.azurePrs.card.openInAzure',
              'Open in Azure DevOps'
            )}
            title={translate('auto.components.azurePrs.card.openInAzure', 'Open in Azure DevOps')}
          >
            <ExternalLink className="size-3" />
          </Button>
        )}
      </div>

      {selecting ? (
        <span className="line-clamp-2 text-[13px] leading-snug font-medium" title={pr.title}>
          {pr.title}
        </span>
      ) : (
        <button
          type="button"
          onClick={openPullRequest}
          className="line-clamp-2 text-left text-[13px] leading-snug font-medium hover:underline"
          title={pr.title}
        >
          {pr.title}
        </button>
      )}

      <div className="flex min-w-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <span className="truncate">{pr.sourceBranch}</span>
        <ArrowRight className="size-2.5 shrink-0 opacity-50" />
        <span className="truncate">{pr.targetBranch}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <AzurePullRequestChip className={style.badge} title={label.long}>
          {label.short}
        </AzurePullRequestChip>

        {pr.policies.map((policy) => (
          <AzurePullRequestChip
            key={`${policy.name}-${policy.status}`}
            className={cn('max-w-full', policyToneClass(policy.status))}
            title={`${policy.name}: ${policyLabel(policy.status)}`}
          >
            <ShieldCheck className="size-3 shrink-0" />
            <span className="truncate">{policyLabel(policy.status)}</span>
          </AzurePullRequestChip>
        ))}

        {pr.workItemIds
          .filter((id) => id !== groupedUnder)
          .map((id) => (
            <AzurePullRequestChip
              key={id}
              title={
                groupedUnder !== null
                  ? translate(
                      'auto.components.azurePrs.card.alsoLinked',
                      'This PR is also linked to item #{{value0}}',
                      { value0: id }
                    )
                  : translate('auto.components.azurePrs.card.item', 'Item #{{value0}}', {
                      value0: id
                    })
              }
            >
              <Ticket className="size-3" />#{id}
            </AzurePullRequestChip>
          ))}

        {pr.totalThreads > 0 ? (
          <AzurePullRequestChip
            className={
              pr.activeThreads > 0 ? 'border-status-warning-border text-status-warning' : undefined
            }
            title={translate(
              'auto.components.azurePrs.card.threads',
              '{{value0}} of {{value1}} threads unresolved',
              { value0: pr.activeThreads, value1: pr.totalThreads }
            )}
          >
            <MessageSquare className="size-3" />
            {pr.activeThreads}/{pr.totalThreads}
          </AzurePullRequestChip>
        ) : null}
      </div>

      {pr.signals.length > 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {pr.signals.map(signalText).join(' · ')}
        </p>
      ) : null}

      <div className="mt-auto flex items-center gap-2 pt-0.5">
        <AzureReviewerAvatars
          reviewers={pr.reviewers}
          onSelect={selecting ? undefined : setCommentsReviewer}
        />
        <span
          className="ml-auto truncate text-[10px] text-muted-foreground"
          title={
            pr.isMine
              ? translate(
                  'auto.components.azurePrs.card.age',
                  '!{{value0}} · open for {{value1}}',
                  {
                    value0: pr.id,
                    value1: ageLabel(pr.ageDays)
                  }
                )
              : translate(
                  'auto.components.azurePrs.card.ageBy',
                  '!{{value0}} · open for {{value1}} · by {{value2}}',
                  { value0: pr.id, value1: ageLabel(pr.ageDays), value2: pr.createdBy }
                )
          }
        >
          !{pr.id} · {ageLabel(pr.ageDays)}
        </span>
      </div>
      {commentsReviewer ? (
        <AzureReviewerCommentsDialog
          pr={pr}
          reviewer={commentsReviewer}
          onReviewerChange={setCommentsReviewer}
          onClose={() => setCommentsReviewer(null)}
        />
      ) : null}
    </div>
  )
}
