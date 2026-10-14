import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { AzureDevOpsPullRequestSituation } from '../../../../shared/azure-devops-pull-request-board'
import { SITUATION_STYLE } from './azure-pr-tones'

// The situations that call for action today, in the order the original dashboard shows them.
function tileDefinitions(): { key: AzureDevOpsPullRequestSituation; label: string }[] {
  return [
    { key: 'conflicts', label: translate('auto.components.azurePrs.tile.conflicts', 'Conflict') },
    { key: 'rejected', label: translate('auto.components.azurePrs.tile.rejected', 'Rejected') },
    { key: 'build_failed', label: translate('auto.components.azurePrs.tile.policy', 'Policy') },
    {
      key: 'waiting_author',
      label: translate('auto.components.azurePrs.tile.waitingAuthor', 'Ball in my court')
    },
    { key: 'pending', label: translate('auto.components.azurePrs.tile.pending', 'Pending') },
    { key: 'approved', label: translate('auto.components.azurePrs.tile.approved', 'Approved') }
  ]
}

export function AzurePullRequestSummaryTiles({
  counts
}: {
  counts: Partial<Record<string, number>>
}): React.JSX.Element {
  return (
    <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-6">
      {tileDefinitions().map((tile) => (
        <div
          key={tile.key}
          className="flex flex-col rounded-xl border border-border/50 bg-card/40 px-3 py-2.5"
        >
          <span
            className={cn('text-2xl font-semibold tabular-nums', SITUATION_STYLE[tile.key].tile)}
          >
            {counts[tile.key] ?? 0}
          </span>
          <span className="text-[11px] leading-tight text-muted-foreground">{tile.label}</span>
        </div>
      ))}
    </div>
  )
}
