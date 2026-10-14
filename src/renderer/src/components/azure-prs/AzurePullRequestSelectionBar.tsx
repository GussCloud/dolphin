import { Send } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

export function AzurePullRequestSelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  onCancel,
  onCompose
}: {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClear: () => void
  onCancel: () => void
  onCompose: () => void
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-xs text-muted-foreground">
        {translate(
          'auto.components.azurePrs.selection.count',
          '{{value0}} of {{value1}} selected',
          {
            value0: selectedCount,
            value1: totalCount
          }
        )}
      </span>
      <Button
        variant="ghost"
        size="xs"
        onClick={onSelectAll}
        disabled={totalCount === 0 || selectedCount === totalCount}
      >
        {translate('auto.components.azurePrs.selection.selectAll', 'Select all')}
      </Button>
      <Button variant="ghost" size="xs" onClick={onClear} disabled={selectedCount === 0}>
        {translate('auto.components.azurePrs.selection.clear', 'Clear selection')}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {translate('auto.components.azurePrs.selection.cancel', 'Cancel')}
        </Button>
        <Button size="sm" disabled={selectedCount === 0} onClick={onCompose}>
          <Send className="size-3.5" />
          {translate('auto.components.azurePrs.selection.generate', 'Generate text')}
        </Button>
      </div>
    </div>
  )
}
