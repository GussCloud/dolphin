import { translate } from '@/i18n/i18n'
import {
  isDesignStatus,
  latestDesignCanvas,
  type Design,
  type DesignEvent
} from '../../../../shared/design-types'
import { designVersionLabel } from './design-canvas-history'
import { designStatusLabel } from './design-status-labels'

const ID_LIST = /^[\w-]+(,[\w-]+)*$/
const VERSION = /^v(\d+)$/
const STATUS_MOVE = /^(\S+) -> (\S+)$/
const COUNT = /^\d+$/
const UNACKED_NUDGES = /^(\d+) nudges unacked$/
const EXCERPT_CHARS = 80

function excerpt(text: string): string {
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS - 1)}…` : text
}

function versionDetail(detail: string): string {
  const match = VERSION.exec(detail)
  return match ? designVersionLabel(Number(match[1])) : detail
}

/** "Draft → In progress"; a move into In progress also names the canvas it approved. */
function statusMoveDetail(
  event: DesignEvent,
  detail: string,
  design: Pick<Design, 'canvasVersions'>
): string {
  const match = STATUS_MOVE.exec(detail)
  const [from, to] = [match?.[1], match?.[2]]
  if (!isDesignStatus(from) || !isDesignStatus(to)) {
    return detail
  }
  const move = `${designStatusLabel(from)} → ${designStatusLabel(to)}`
  const approved =
    to === 'in-progress'
      ? design.canvasVersions.findLast((version) => version.at <= event.at)?.version
      : undefined
  return approved === undefined
    ? move
    : `${move} · ${translate('auto.components.design.eventDetail.approvedVersion', 'version {{value0}} approved', { value0: approved })}`
}

/**
 * A localized line for the event's host detail, read from the shapes the host writes and the design's
 * own data. Unknown shapes show the raw detail; an absent detail shows nothing.
 */
export function designEventDetail(
  event: DesignEvent,
  design: Pick<Design, 'decisions' | 'messages' | 'canvasVersions'>
): string | null {
  const detail = event.detail
  if (!detail) {
    return null
  }
  switch (event.kind) {
    case 'canvas-set':
    case 'completion-requested':
      return versionDetail(detail)
    case 'status-changed':
    case 'completion-confirmed':
      return statusMoveDetail(event, detail, design)
    case 'completion-declined': {
      const text = design.messages.find((message) => message.id === detail)?.text
      return text
        ? translate('auto.components.design.eventDetail.askedFor', 'Asked for: "{{value0}}"', {
            value0: excerpt(text)
          })
        : detail
    }
    case 'agent-bound':
      return detail === 'rebound'
        ? translate('auto.components.design.eventDetail.rebound', 'Moved to a new terminal')
        : detail
    case 'decision-asked': {
      if (!ID_LIST.test(detail)) {
        return detail
      }
      const ids = detail.split(',')
      const questions = ids.flatMap((id) => {
        const question = design.decisions.find((decision) => decision.id === id)?.question
        return question ? [excerpt(question)] : []
      })
      return questions.length === ids.length
        ? questions.join(' · ')
        : translate('auto.components.design.eventDetail.decisionCount', '{{value0}} decisions', {
            value0: ids.length
          })
    }
    case 'decision-answered':
    case 'decision-revised': {
      const question = design.decisions.find((decision) => decision.id === detail)?.question
      return question ? excerpt(question) : detail
    }
    case 'comment-added': {
      if (detail === 'design') {
        return translate('auto.components.design.eventDetail.wholeDesign', 'On the whole design')
      }
      const title = (latestDesignCanvas(design)?.canvas.groups ?? [])
        .flatMap((group) => group.blocks)
        .find((block) => block.id === detail)?.title
      return title
        ? translate('auto.components.design.eventDetail.onBlock', 'On {{value0}}', {
            value0: title
          })
        : detail
    }
    case 'agent-replied': {
      const text = design.messages.find((message) => message.id === detail)?.text
      return text
        ? translate('auto.components.design.eventDetail.replyTo', 'Reply to "{{value0}}"', {
            value0: excerpt(text)
          })
        : detail
    }
    case 'inbox-acked':
      return ID_LIST.test(detail)
        ? translate('auto.components.design.eventDetail.itemsRead', 'Items read: {{value0}}', {
            value0: detail.split(',').length
          })
        : detail
    case 'inbox-nudged':
      return COUNT.test(detail)
        ? translate('auto.components.design.eventDetail.nudge', 'Notice {{value0}}', {
            value0: Number(detail)
          })
        : detail
    case 'delivery-blocked': {
      const match = UNACKED_NUDGES.exec(detail)
      return match
        ? translate(
            'auto.components.design.eventDetail.unreadNotices',
            'Unread notices: {{value0}}',
            { value0: Number(match[1]) }
          )
        : detail
    }
    case 'created':
    case 'renamed':
    case 'delivery-resent':
      return detail
  }
}
