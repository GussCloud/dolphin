import {
  isDesignDecisionOpen,
  pendingDesignInbox,
  type Design,
  type DesignDecision,
  type DesignMessage
} from '../../../../shared/design-types'

export type DesignBlockActivity = { openDecisions: number; messages: number }

/** Per-block counts for the canvas badges; blocks with nothing to show are absent. */
export function designBlockActivity(
  design: Pick<Design, 'decisions' | 'messages'>
): Map<string, DesignBlockActivity> {
  const activity = new Map<string, DesignBlockActivity>()
  const entry = (blockId: string): DesignBlockActivity => {
    const existing = activity.get(blockId)
    if (existing) {
      return existing
    }
    const created = { openDecisions: 0, messages: 0 }
    activity.set(blockId, created)
    return created
  }
  for (const decision of design.decisions) {
    if (decision.blockId && isDesignDecisionOpen(decision)) {
      entry(decision.blockId).openDecisions += 1
    }
  }
  for (const message of design.messages) {
    if (message.blockId) {
      entry(message.blockId).messages += 1
    }
  }
  return activity
}

export type DesignThreadEntry = { message: DesignMessage; replies: DesignMessage[] }

/**
 * One thread (a block's, or the general one when blockId is undefined), oldest first. Agent replies
 * nest under the user message they answer; a reply whose target is not in this thread stands alone.
 */
export function designThread(
  messages: readonly DesignMessage[],
  blockId: string | undefined
): DesignThreadEntry[] {
  const own = messages
    .filter((message) => message.blockId === blockId)
    .toSorted((a, b) => a.at - b.at)
  const rootIds = new Set(
    own.filter((message) => message.author === 'user').map((message) => message.id)
  )
  const isNested = (message: DesignMessage): boolean =>
    message.author === 'agent' && message.replyTo !== undefined && rootIds.has(message.replyTo)
  return own
    .filter((message) => !isNested(message))
    .map((message) => ({
      message,
      replies: own.filter((reply) => isNested(reply) && reply.replyTo === message.id)
    }))
}

/** Open decisions first (oldest question first), then answered ones (latest answer first). */
export function sortDesignDecisions(decisions: readonly DesignDecision[]): DesignDecision[] {
  const open = decisions.filter(isDesignDecisionOpen).toSorted((a, b) => a.askedAt - b.askedAt)
  const answered = decisions
    .filter((decision) => !isDesignDecisionOpen(decision))
    .toSorted((a, b) => (b.answer?.at ?? 0) - (a.answer?.at ?? 0))
  return [...open, ...answered]
}

export type DesignDeliveryState =
  | { kind: 'blocked'; pending: number }
  | { kind: 'pending'; pending: number }
  | { kind: 'read' }
  /** Nothing was ever sent, so there is nothing to claim about reading. */
  | { kind: 'idle' }

/** What the banner says about the user's input the agent has not acknowledged yet. */
export function designDeliveryState(
  design: Pick<Design, 'inbox' | 'delivery'>
): DesignDeliveryState {
  const pending = pendingDesignInbox(design).length
  if (design.delivery.blockedAt !== undefined) {
    return { kind: 'blocked', pending }
  }
  if (pending > 0) {
    return { kind: 'pending', pending }
  }
  return design.inbox.length > 0 ? { kind: 'read' } : { kind: 'idle' }
}
