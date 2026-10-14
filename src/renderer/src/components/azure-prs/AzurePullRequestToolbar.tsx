import { Layers, RefreshCw, Send } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type AzurePullRequestFilter = 'mine' | 'reviewing' | 'all'

function isFilter(value: string): value is AzurePullRequestFilter {
  return value === 'mine' || value === 'reviewing' || value === 'all'
}

export function AzurePullRequestToolbar({
  filter,
  onFilterChange,
  identityEmail,
  grouped,
  onToggleGrouped,
  selecting,
  onToggleSelecting,
  loading,
  onRefresh
}: {
  filter: AzurePullRequestFilter
  onFilterChange: (filter: AzurePullRequestFilter) => void
  identityEmail: string | null
  grouped: boolean
  onToggleGrouped: () => void
  selecting: boolean
  onToggleSelecting: () => void
  loading: boolean
  onRefresh: () => void
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={filter}
        // Radix reports an empty string when the active item is clicked again; keep the filter.
        onValueChange={(value) => {
          if (isFilter(value)) {
            onFilterChange(value)
          }
        }}
      >
        <ToggleGroupItem value="mine">
          {translate('auto.components.azurePrs.filter.mine', 'My PRs')}
        </ToggleGroupItem>
        <ToggleGroupItem value="reviewing">
          {translate('auto.components.azurePrs.filter.reviewing', 'Reviewing')}
        </ToggleGroupItem>
        <ToggleGroupItem value="all">
          {translate('auto.components.azurePrs.filter.all', 'All')}
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {identityEmail ? <span>{identityEmail}</span> : null}
        <Button
          variant={grouped ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleGrouped}
          aria-pressed={grouped}
          title={
            grouped
              ? translate('auto.components.azurePrs.toolbar.ungroupHint', 'Back to the flat list')
              : translate(
                  'auto.components.azurePrs.toolbar.groupHint',
                  'Group the cards by PBI/Bug'
                )
          }
        >
          <Layers className="size-3.5" />
          {translate('auto.components.azurePrs.toolbar.group', 'Group')}
        </Button>
        <Button
          variant={selecting ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleSelecting}
          aria-pressed={selecting}
          title={translate(
            'auto.components.azurePrs.toolbar.requestReviewHint',
            'Build the review request text to send on Teams'
          )}
        >
          <Send className="size-3.5" />
          {translate('auto.components.azurePrs.toolbar.requestReview', 'Request review')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          {translate('auto.components.azurePrs.toolbar.refresh', 'Refresh')}
        </Button>
      </div>
    </div>
  )
}
