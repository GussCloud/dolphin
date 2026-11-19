import { Bot, Cog, User, type LucideIcon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { Design, DesignEvent } from '../../../../shared/design-types'
import { designEventDetail } from './design-event-detail'
import { designEventKeys, designEventLabel } from './design-event-labels'
import { formatDesignTimestamp } from './design-format'

const ACTOR_ICON: Record<DesignEvent['actor'], LucideIcon> = {
  user: User,
  agent: Bot,
  dolphin: Cog
}

function actorLabel(actor: DesignEvent['actor']): string {
  switch (actor) {
    case 'agent':
      return translate('auto.components.design.thread.agent', 'Agent')
    case 'user':
      return translate('auto.components.design.thread.you', 'You')
    case 'dolphin':
      return translate('auto.components.design.activity.dolphin', 'Dolphin')
  }
}

/** The design's audit trail, newest first. */
export function DesignActivityTimeline({
  design
}: {
  design: Pick<Design, 'events' | 'decisions' | 'messages' | 'canvasVersions'>
}): React.JSX.Element {
  const events = design.events
  const keys = designEventKeys(events)
  const newestFirst = events.map((event, index) => ({ event, key: keys[index] ?? '' })).toReversed()
  if (newestFirst.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {translate('auto.components.design.activity.empty', 'No activity yet.')}
      </p>
    )
  }
  return (
    <ol className="space-y-2.5">
      {newestFirst.map(({ event, key }) => {
        const Icon = ACTOR_ICON[event.actor]
        const detail = designEventDetail(event, design)
        return (
          <li key={key} data-design-event={event.kind} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{designEventLabel(event.kind)}</p>
              {detail ? (
                <p className="break-words text-xs text-muted-foreground">{detail}</p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                {actorLabel(event.actor)}
                {' · '}
                {formatDesignTimestamp(event.at)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
