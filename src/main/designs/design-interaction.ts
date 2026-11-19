// Pure state transitions for the user <-> agent conversation on a design: decisions, block comments
// and agent replies. The store persists what these return; inbox delivery lives in design-inbox.ts.
import { randomBytes } from 'node:crypto'
import {
  DESIGN_DECISION_MAX_OPEN,
  DESIGN_MAX_MESSAGES,
  isDesignDecisionOpen,
  latestDesignCanvas,
  type Design,
  type DesignDecision,
  type DesignDecisionOption,
  type DesignEvent,
  type DesignInboxItem,
  type DesignMessage
} from '../../shared/design-types'

/** Answered decisions and acked inbox items kept as history; open and pending ones are never dropped. */
export const DESIGN_MAX_ANSWERED_DECISIONS = 100
export const DESIGN_MAX_ACKED_INBOX_ITEMS = 100

/** A refusal the agent or the user can act on; RPC turns it into an error with this code and message. */
export class DesignRefusal extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'DesignRefusal'
  }
}

export type DesignPatch = Partial<
  Pick<
    Design,
    | 'name'
    | 'status'
    | 'paneKey'
    | 'worktreeId'
    | 'canvasVersions'
    | 'decisions'
    | 'messages'
    | 'inbox'
    | 'delivery'
  >
>
export type DesignEventInput = Omit<DesignEvent, 'at' | 'detail'> & {
  detail?: string | undefined
}
export type DesignChange<T> = {
  patch: DesignPatch
  event: DesignEventInput
  result: T
}

export type DesignDecisionInput = {
  question: string
  header?: string
  options: DesignDecisionOption[]
  multiSelect?: boolean
  blockId?: string
}

/** Short ids: the agent types them back in `design ack --items`. */
function newId(prefix: string, taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `${prefix}-${randomBytes(4).toString('hex')}`
    if (!taken.has(id)) {
      return id
    }
  }
}

function takenIds(design: Design): Set<string> {
  return new Set([
    ...design.decisions.map((decision) => decision.id),
    ...design.messages.map((message) => message.id),
    ...design.inbox.map((item) => item.id)
  ])
}

export function findBlockTitle(design: Design, blockId: string): string | undefined {
  for (const group of latestDesignCanvas(design)?.canvas.groups ?? []) {
    const block = group.blocks.find((candidate) => candidate.id === blockId)
    if (block) {
      return block.title
    }
  }
  return undefined
}

function requireBlock(design: Design, blockId: string | undefined): void {
  if (blockId !== undefined && findBlockTitle(design, blockId) === undefined) {
    throw new DesignRefusal(
      'design_unknown_block',
      `Block "${blockId}" is not on the latest canvas of design ${design.id}.`
    )
  }
}

function boundDecisions(decisions: DesignDecision[]): DesignDecision[] {
  const answered = decisions.filter((decision) => !isDesignDecisionOpen(decision))
  const excess = answered.length - DESIGN_MAX_ANSWERED_DECISIONS
  if (excess <= 0) {
    return decisions
  }
  const dropped = new Set(answered.slice(0, excess))
  return decisions.filter((decision) => !dropped.has(decision))
}

/** Pending items whose content aged out go too: there is nothing left for the agent to read. */
export function boundInbox(
  inbox: DesignInboxItem[],
  decisions: DesignDecision[],
  messages: DesignMessage[]
): DesignInboxItem[] {
  const refs = new Set([...decisions.map((d) => d.id), ...messages.map((m) => m.id)])
  const live = inbox.filter((item) => refs.has(item.refId))
  const acked = live.filter((item) => item.ackedAt !== undefined)
  const dropped = new Set(acked.slice(0, Math.max(0, acked.length - DESIGN_MAX_ACKED_INBOX_ITEMS)))
  return live.filter((item) => !dropped.has(item))
}

export function addDecisions(
  design: Design,
  inputs: DesignDecisionInput[],
  at: number
): DesignChange<DesignDecision[]> {
  const open = design.decisions.filter(isDesignDecisionOpen).length
  if (open + inputs.length > DESIGN_DECISION_MAX_OPEN) {
    throw new DesignRefusal(
      'design_too_many_open_decisions',
      `Design ${design.id} has ${open} open decisions; at most ${DESIGN_DECISION_MAX_OPEN} may wait for the user at once.`
    )
  }
  const taken = takenIds(design)
  const added = inputs.map((input): DesignDecision => {
    requireBlock(design, input.blockId)
    const id = newId('d', taken)
    taken.add(id)
    return {
      id,
      question: input.question,
      ...(input.header ? { header: input.header } : {}),
      options: input.options,
      multiSelect: input.multiSelect ?? false,
      ...(input.blockId ? { blockId: input.blockId } : {}),
      askedAt: at
    }
  })
  return {
    patch: { decisions: [...design.decisions, ...added] },
    event: {
      kind: 'decision-asked',
      actor: 'agent',
      detail: added.map((d) => d.id).join(',')
    },
    result: added
  }
}

export function answerDecision(
  design: Design,
  answer: { decisionId: string; selected: string[]; note?: string | undefined },
  at: number
): DesignChange<DesignDecision> {
  const decision = design.decisions.find((candidate) => candidate.id === answer.decisionId)
  if (!decision) {
    throw new DesignRefusal(
      'design_decision_not_found',
      `Decision ${answer.decisionId} is not on design ${design.id}.`
    )
  }
  if (!isDesignDecisionOpen(decision)) {
    throw new DesignRefusal(
      'design_decision_answered',
      `Decision ${decision.id} was already answered.`
    )
  }
  const selected = [...new Set(answer.selected)]
  const labels = new Set(decision.options.map((option) => option.label))
  const unknown = selected.filter((label) => !labels.has(label))
  if (unknown.length > 0) {
    throw new DesignRefusal(
      'design_invalid_answer',
      `Not an option of decision ${decision.id}: ${unknown.join(', ')}.`
    )
  }
  if (!decision.multiSelect && selected.length !== 1) {
    throw new DesignRefusal(
      'design_invalid_answer',
      `Decision ${decision.id} takes exactly one option.`
    )
  }
  const answered: DesignDecision = {
    ...decision,
    answer: { selected, ...(answer.note ? { note: answer.note } : {}), at }
  }
  const decisions = boundDecisions(
    design.decisions.map((d) => (d.id === decision.id ? answered : d))
  )
  const item: DesignInboxItem = {
    id: newId('i', takenIds(design)),
    kind: 'answer',
    refId: decision.id,
    createdAt: at
  }
  return {
    patch: {
      decisions,
      inbox: boundInbox([...design.inbox, item], decisions, design.messages)
    },
    event: { kind: 'decision-answered', actor: 'user', detail: decision.id },
    result: answered
  }
}

export function addComment(
  design: Design,
  comment: { blockId?: string | undefined; text: string },
  at: number
): DesignChange<DesignMessage> {
  requireBlock(design, comment.blockId)
  const taken = takenIds(design)
  const message: DesignMessage = {
    id: newId('m', taken),
    author: 'user',
    text: comment.text,
    ...(comment.blockId ? { blockId: comment.blockId } : {}),
    at
  }
  taken.add(message.id)
  const messages = [...design.messages, message].slice(-DESIGN_MAX_MESSAGES)
  const item: DesignInboxItem = {
    id: newId('i', taken),
    kind: 'comment',
    refId: message.id,
    createdAt: at
  }
  return {
    patch: {
      messages,
      inbox: boundInbox([...design.inbox, item], design.decisions, messages)
    },
    event: {
      kind: 'comment-added',
      actor: 'user',
      detail: comment.blockId ?? 'design'
    },
    result: message
  }
}

export function addReply(
  design: Design,
  reply: {
    replyTo?: string | undefined
    blockId?: string | undefined
    text: string
  },
  at: number
): DesignChange<DesignMessage> {
  let blockId = reply.blockId
  if (reply.replyTo !== undefined) {
    const target = design.messages.find((message) => message.id === reply.replyTo)
    if (!target || target.author !== 'user') {
      throw new DesignRefusal(
        'design_unknown_message',
        `replyTo "${reply.replyTo}" is not a user message on design ${design.id}.`
      )
    }
    if (blockId !== undefined && blockId !== target.blockId) {
      throw new DesignRefusal(
        'design_reply_block_mismatch',
        `Message ${target.id} is on ${target.blockId ? `block "${target.blockId}"` : 'the design'}; drop blockId or match it.`
      )
    }
    // Why: a reply lives in the thread it answers, even if the canvas has since dropped the block.
    blockId = target.blockId
  } else {
    requireBlock(design, blockId)
  }
  const message: DesignMessage = {
    id: newId('m', takenIds(design)),
    author: 'agent',
    text: reply.text,
    ...(blockId ? { blockId } : {}),
    ...(reply.replyTo ? { replyTo: reply.replyTo } : {}),
    at
  }
  const messages = [...design.messages, message].slice(-DESIGN_MAX_MESSAGES)
  return {
    patch: {
      messages,
      inbox: boundInbox(design.inbox, design.decisions, messages)
    },
    event: { kind: 'agent-replied', actor: 'agent', detail: reply.replyTo },
    result: message
  }
}
