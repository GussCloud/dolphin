import {
  pendingDesignInbox,
  type Design,
  type DesignAgentStatus,
  type DesignInboxItem
} from '../../../../shared/design-types'
import type { DesignDeliveryState } from './design-conversation'

export type DesignProcessingState =
  /** Nothing sent, or everything sent was read and needs no answer shown. */
  | 'idle'
  /** User input waiting, no notice typed yet. */
  | 'queued'
  /** A notice was typed; the agent has not read it yet. */
  | 'notified'
  | 'processing'
  | 'needs-permission'
  /** The agent answered (reply, canvas or decision) after the user's latest input. */
  | 'replied'
  /** Input is waiting and the agent's status cannot be read. */
  | 'unknown'
  /** Input is waiting and no live terminal holds the agent. */
  | 'offline'
  /** Dolphin stopped notifying after unread notices; the delivery banner offers a resend. */
  | 'blocked'

type ProcessingInput = Pick<
  Design,
  'inbox' | 'delivery' | 'messages' | 'canvasVersions' | 'decisions' | 'completion'
>

/** Newest moment the agent produced something the user sees; -Infinity when it never did. */
export function designLastAgentOutputAt(
  design: Omit<ProcessingInput, 'inbox' | 'delivery'>
): number {
  return Math.max(
    -Infinity,
    ...design.messages.filter((message) => message.author === 'agent').map((message) => message.at),
    ...design.canvasVersions.map((version) => version.at),
    ...design.decisions.map((decision) => decision.askedAt),
    design.completion?.at ?? -Infinity
  )
}

/** Inbox items the agent has not read, or read without producing anything since. */
export function designItemsAwaitingAgent(design: ProcessingInput): DesignInboxItem[] {
  const lastOutputAt = designLastAgentOutputAt(design)
  const repliedTo = new Set(
    design.messages.flatMap((message) =>
      message.author === 'agent' && message.replyTo ? [message.replyTo] : []
    )
  )
  return design.inbox.filter(
    (item) =>
      item.ackedAt === undefined ||
      (item.createdAt > lastOutputAt && !(item.kind === 'comment' && repliedTo.has(item.refId)))
  )
}

/**
 * Where the conversation with the agent stands. `agentStatus` null means it could not be read
 * (still loading, a host without `design.agentStatus`, or a failed call): unverifiable, never idle.
 */
export function designProcessingState(
  design: ProcessingInput,
  agentStatus: DesignAgentStatus | null
): DesignProcessingState {
  const awaiting = designItemsAwaitingAgent(design).length > 0
  if (agentStatus?.live === false) {
    return awaiting ? 'offline' : 'idle'
  }
  const status = agentStatus?.status ?? null
  if (status === 'permission') {
    return 'needs-permission'
  }
  if (status === 'working') {
    return 'processing'
  }
  if (status === null) {
    return awaiting ? 'unknown' : 'idle'
  }
  // Why: an agent that stopped reading is not processing, so approval must not stay locked forever.
  if (design.delivery.blockedAt !== undefined && pendingDesignInbox(design).length > 0) {
    return 'blocked'
  }
  if (pendingDesignInbox(design).length > 0) {
    return design.delivery.nudges > 0 ? 'notified' : 'queued'
  }
  const lastInputAt = Math.max(-Infinity, ...design.inbox.map((item) => item.createdAt))
  return design.inbox.length > 0 && designLastAgentOutputAt(design) > lastInputAt
    ? 'replied'
    : 'idle'
}

/** Approving while the agent still has the user's input in hand would race its next canvas. */
export function designProcessingBlocksApproval(state: DesignProcessingState): boolean {
  return (
    state === 'queued' ||
    state === 'notified' ||
    state === 'processing' ||
    state === 'needs-permission'
  )
}

/** Items the agent is working on, for the inline "processing" line; empty unless processing. */
export function designItemsBeingProcessed(
  design: ProcessingInput,
  state: DesignProcessingState
): DesignInboxItem[] {
  if (state !== 'processing') {
    return []
  }
  const notifiedUpTo = design.delivery.lastNudgeAt
  // Why the notified ones: the notice says "act on it, then ack", so an agent acks only when done.
  return designItemsAwaitingAgent(design).filter(
    (item) =>
      item.ackedAt !== undefined || (notifiedUpTo !== undefined && item.createdAt <= notifiedUpTo)
  )
}

export type DesignProcessingTargets = {
  /** Blocks whose thread holds a comment being processed. */
  blockIds: ReadonlySet<string>
  /** A comment on the general conversation is being processed. */
  general: boolean
  decisionIds: ReadonlySet<string>
}

/** Where to draw the inline "processing" line: the threads and decision cards the agent is answering. */
export function designProcessingTargets(
  design: ProcessingInput,
  state: DesignProcessingState
): DesignProcessingTargets {
  const blockIds = new Set<string>()
  const decisionIds = new Set<string>()
  let general = false
  for (const item of designItemsBeingProcessed(design, state)) {
    if (item.kind === 'answer') {
      decisionIds.add(item.refId)
    } else if (item.kind === 'comment') {
      const message = design.messages.find((entry) => entry.id === item.refId)
      if (message?.blockId) {
        blockIds.add(message.blockId)
      } else if (message) {
        general = true
      }
    }
  }
  return { blockIds, general, decisionIds }
}

/**
 * Which side-panel notice speaks: the delivery banner keeps its blocked and notify-now prompts (they
 * carry the action), and otherwise yields to the processing indicator whenever that has news.
 */
export function designSidePanelNotices(
  delivery: DesignDeliveryState,
  state: DesignProcessingState
): { delivery: boolean; processing: boolean } {
  const deliveryActionable =
    delivery.kind === 'blocked' || (delivery.kind === 'pending' && delivery.offerNotifyNow)
  if (deliveryActionable) {
    // Why: those states already say the agent has not read; only live work or absence adds news.
    return {
      delivery: true,
      processing: state === 'processing' || state === 'needs-permission' || state === 'offline'
    }
  }
  return state === 'idle'
    ? { delivery: true, processing: false }
    : { delivery: false, processing: true }
}
