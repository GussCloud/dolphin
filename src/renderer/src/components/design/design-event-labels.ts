import { translate } from '@/i18n/i18n'
import type { DesignEvent, DesignEventKind } from '../../../../shared/design-types'

/** React keys for events, which carry no id: identical entries get an occurrence suffix. */
export function designEventKeys(events: readonly DesignEvent[]): string[] {
  const seen = new Map<string, number>()
  return events.map((event) => {
    const base = `${event.at}:${event.kind}:${event.actor}:${event.detail ?? ''}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}#${count}`
  })
}

export function designEventLabel(kind: DesignEventKind): string {
  switch (kind) {
    case 'created':
      return translate('auto.components.design.event.created', 'Design created')
    case 'agent-bound':
      return translate('auto.components.design.event.agentBound', 'Agent connected')
    case 'canvas-set':
      return translate('auto.components.design.event.canvasSet', 'Canvas drawn')
    case 'status-changed':
      return translate('auto.components.design.event.statusChanged', 'Status changed')
    case 'renamed':
      return translate('auto.components.design.event.renamed', 'Renamed')
    case 'decision-asked':
      return translate('auto.components.design.event.decisionAsked', 'Decision asked')
    case 'decision-answered':
      return translate('auto.components.design.event.decisionAnswered', 'Decision answered')
    case 'comment-added':
      return translate('auto.components.design.event.commentAdded', 'Comment sent')
    case 'agent-replied':
      return translate('auto.components.design.event.agentReplied', 'Agent replied')
    case 'inbox-nudged':
      return translate('auto.components.design.event.inboxNudged', 'Agent notified')
    case 'inbox-acked':
      return translate('auto.components.design.event.inboxAcked', 'Agent read the messages')
    case 'delivery-blocked':
      return translate(
        'auto.components.design.event.deliveryBlocked',
        'Agent stopped responding to notices'
      )
    case 'delivery-resent':
      return translate('auto.components.design.event.deliveryResent', 'Notice sent again')
    case 'completion-requested':
      return translate(
        'auto.components.design.event.completionRequested',
        'Agent reported the implementation done'
      )
    case 'completion-confirmed':
      return translate('auto.components.design.event.completionConfirmed', 'You confirmed it done')
    case 'completion-declined':
      return translate('auto.components.design.event.completionDeclined', 'You asked for changes')
  }
}
