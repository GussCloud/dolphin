// The inbox side of a design conversation: what the agent reads, acks, and how its delivery is tracked.
import type { Design, DesignInboxEntry } from '../../shared/design-types'
import { boundInbox, DesignRefusal, findBlockTitle, type DesignChange } from './design-interaction'

/** Already-acked ids are accepted again so a retried ack is harmless; unknown ids are refused. */
export function ackInbox(design: Design, itemIds: string[], at: number): DesignChange<number> {
  const ids = new Set(itemIds)
  const known = new Set(design.inbox.map((item) => item.id))
  const unknown = [...ids].filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new DesignRefusal(
      'design_unknown_inbox_item',
      `Not in the inbox of design ${design.id}: ${unknown.join(', ')}. Run \`dolphin design inbox --id ${design.id}\` for the current ids.`
    )
  }
  let acked = 0
  const inbox = design.inbox.map((item) => {
    if (!ids.has(item.id) || item.ackedAt !== undefined) {
      return item
    }
    acked += 1
    return { ...item, ackedAt: at }
  })
  return {
    // Why lastNudgeAt is dropped too: the agent is responsive, so new input may be announced at once.
    patch: {
      inbox: boundInbox(inbox, design.decisions, design.messages),
      delivery: { nudges: 0 }
    },
    event: { kind: 'inbox-acked', actor: 'agent', detail: [...ids].join(',') },
    result: acked
  }
}

export function recordNudge(design: Design, at: number): DesignChange<number> {
  const nudges = design.delivery.nudges + 1
  return {
    patch: { delivery: { ...design.delivery, nudges, lastNudgeAt: at } },
    event: { kind: 'inbox-nudged', actor: 'dolphin', detail: String(nudges) },
    result: nudges
  }
}

export function markDeliveryBlocked(design: Design, at: number): DesignChange<void> {
  return {
    patch: { delivery: { ...design.delivery, blockedAt: at } },
    event: {
      kind: 'delivery-blocked',
      actor: 'dolphin',
      detail: `${design.delivery.nudges} nudges unacked`
    },
    result: undefined
  }
}

export function resendDelivery(): DesignChange<void> {
  return {
    patch: { delivery: { nudges: 0 } },
    event: { kind: 'delivery-resent', actor: 'user' },
    result: undefined
  }
}

/** Pending items with their content resolved, so the agent needs one call to read everything. */
export function expandDesignInbox(design: Design): DesignInboxEntry[] {
  const entries: DesignInboxEntry[] = []
  const blockOf = (blockId: string | undefined): Pick<DesignInboxEntry, 'block'> => {
    if (blockId === undefined) {
      return {}
    }
    const title = findBlockTitle(design, blockId)
    return {
      block: { id: blockId, ...(title === undefined ? {} : { title }) }
    }
  }
  for (const item of design.inbox) {
    if (item.ackedAt !== undefined) {
      continue
    }
    const base = { id: item.id, createdAt: item.createdAt }
    if (item.kind === 'answer') {
      const decision = design.decisions.find((d) => d.id === item.refId)
      if (decision?.answer) {
        entries.push({
          ...base,
          ...blockOf(decision.blockId),
          kind: 'answer',
          decisionId: decision.id,
          question: decision.question,
          selected: decision.answer.selected,
          ...(decision.answer.note ? { note: decision.answer.note } : {})
        })
      }
      continue
    }
    const message = design.messages.find((m) => m.id === item.refId)
    if (message) {
      entries.push({
        ...base,
        ...blockOf(message.blockId),
        kind: 'comment',
        messageId: message.id,
        text: message.text
      })
    }
  }
  return entries
}
