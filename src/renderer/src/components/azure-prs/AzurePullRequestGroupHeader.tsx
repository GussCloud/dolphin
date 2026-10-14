import { ExternalLink, Ticket } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AzurePullRequestChip } from './AzurePullRequestChip'
import { NO_WORK_ITEM_GROUP_KEY, type AzurePullRequestGroup } from './azure-pr-groups'
import { workItemTypeLabel } from './azure-pr-labels'
import { workItemTypeToneClass } from './azure-pr-tones'

export function AzurePullRequestGroupHeader({
  group
}: {
  group: AzurePullRequestGroup
}): React.JSX.Element {
  const { workItem: item, workItemId: id } = group
  const noItem = group.key === NO_WORK_ITEM_GROUP_KEY
  const count = group.pullRequests.length

  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
      {noItem ? (
        <AzurePullRequestChip className="border-dashed text-muted-foreground">
          {translate('auto.components.azurePrs.group.noItem', 'No linked item')}
        </AzurePullRequestChip>
      ) : (
        <AzurePullRequestChip
          className={workItemTypeToneClass(item?.workItemType ?? '')}
          title={
            item?.workItemType ??
            translate('auto.components.azurePrs.group.typeNotLoaded', 'Type not loaded')
          }
        >
          <Ticket className="size-3" />
          {item
            ? workItemTypeLabel(item.workItemType)
            : translate('auto.components.azurePrs.group.item', 'Item')}{' '}
          #{id}
        </AzurePullRequestChip>
      )}

      {/* A missing title is not a broken group: the id alone still groups correctly. */}
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[13px] font-medium',
          !noItem && !item && 'text-muted-foreground italic'
        )}
        title={item?.title}
      >
        {noItem
          ? translate(
              'auto.components.azurePrs.group.noItemTitle',
              'PRs with no PBI, Bug or Task linked'
            )
          : (item?.title ??
            translate('auto.components.azurePrs.group.titleNotLoaded', 'title not loaded'))}
      </span>

      {item?.state ? (
        <AzurePullRequestChip className="text-muted-foreground">{item.state}</AzurePullRequestChip>
      ) : null}

      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {count === 1
          ? translate('auto.components.azurePrs.group.prCountOne', '1 PR')
          : translate('auto.components.azurePrs.group.prCountMany', '{{value0}} PRs', {
              value0: count
            })}
      </span>

      {item ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          onClick={() => void window.api.shell.openUrl(item.url)}
          aria-label={translate(
            'auto.components.azurePrs.group.openItem',
            'Open #{{value0}} in Azure DevOps ({{value1}})',
            { value0: item.id, value1: item.project }
          )}
          title={translate(
            'auto.components.azurePrs.group.openItem',
            'Open #{{value0}} in Azure DevOps ({{value1}})',
            { value0: item.id, value1: item.project }
          )}
        >
          <ExternalLink />
        </Button>
      ) : null}
    </div>
  )
}
