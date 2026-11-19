import { CircleHelp, MessageSquare } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { DesignBlockActivity } from './design-conversation'

// Why: plain spans, not Badge; each chip needs its own tone and the Badge primitive owns its color.
export function DesignBlockActivityChips({
  activity
}: {
  activity: DesignBlockActivity | undefined
}): React.JSX.Element | null {
  if (!activity || (activity.openDecisions === 0 && activity.messages === 0)) {
    return null
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      {activity.openDecisions > 0 ? (
        <span
          data-design-block-decisions={activity.openDecisions}
          aria-label={translate(
            'auto.components.design.block.openDecisions',
            '{{value0}} open decisions',
            { value0: activity.openDecisions }
          )}
          className="inline-flex items-center gap-0.5 rounded-full border border-status-warning-border bg-status-warning-background px-1.5 text-[10px] font-medium leading-4 text-status-warning"
        >
          <CircleHelp className="size-3" />
          {activity.openDecisions}
        </span>
      ) : null}
      {activity.messages > 0 ? (
        <span
          data-design-block-messages={activity.messages}
          aria-label={translate('auto.components.design.block.messages', '{{value0}} messages', {
            value0: activity.messages
          })}
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted px-1.5 text-[10px] font-medium leading-4 text-muted-foreground"
        >
          <MessageSquare className="size-3" />
          {activity.messages}
        </span>
      ) : null}
    </span>
  )
}
