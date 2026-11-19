import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { DesignListAttention } from './design-list-attention'

/** Designs the filters hide that wait on the user; "Show" widens the filters to them. */
export function DesignListAttentionNotice({
  attention,
  onShow
}: {
  attention: DesignListAttention
  onShow: () => void
}): React.JSX.Element {
  const parts = [
    attention.completion > 0
      ? translate(
          'auto.components.design.attention.completion',
          '{{value0}} waiting for your confirmation',
          { value0: attention.completion }
        )
      : null,
    attention.decisions > 0
      ? translate('auto.components.design.attention.decisions', '{{value0}} with open decisions', {
          value0: attention.decisions
        })
      : null,
    attention.blocked > 0
      ? translate(
          'auto.components.design.attention.blocked',
          '{{value0}} with an agent not responding',
          { value0: attention.blocked }
        )
      : null
  ].filter(Boolean)
  return (
    <div
      data-design-attention=""
      className="flex shrink-0 items-center gap-2 rounded-lg border border-status-warning-border bg-status-warning-background px-3 py-2 text-xs text-status-warning"
    >
      <BellRing className="size-3.5 shrink-0" />
      <p className="min-w-0 flex-1">
        {translate('auto.components.design.attention.hidden', 'Hidden by the filters: {{value0}}', {
          value0: parts.join(' · ')
        })}
      </p>
      <Button type="button" size="xs" variant="outline" onClick={onShow}>
        {translate('auto.components.design.attention.show', 'Show')}
      </Button>
    </div>
  )
}
