// Pure state transitions for a design's lifecycle after planning: the user moves its status, the
// agent reports the approved design implemented, and the user confirms (→ done) or sends what is left.
import {
  canTransitionDesign,
  latestDesignCanvas,
  type Design,
  type DesignInboxItem,
  type DesignStatus
} from '../../shared/design-types'
import {
  addComment,
  boundInbox,
  DesignRefusal,
  newDesignInboxId,
  type DesignChange
} from './design-interaction'

/**
 * Tells a bound agent about the move. An unread older status item is dropped: only the latest move
 * is what the agent must act on.
 */
function withStatusItem(design: Design, status: DesignStatus, at: number): DesignInboxItem[] {
  if (design.paneKey === null) {
    return design.inbox
  }
  const canvasVersion = status === 'in-progress' ? latestDesignCanvas(design)?.version : undefined
  const item: DesignInboxItem = {
    id: newDesignInboxId(design),
    kind: 'status',
    refId: status,
    ...(canvasVersion === undefined ? {} : { canvasVersion }),
    createdAt: at
  }
  const kept = design.inbox.filter((i) => i.kind !== 'status' || i.ackedAt !== undefined)
  return boundInbox([...kept, item], design.decisions, design.messages)
}

export function changeDesignStatus(
  design: Design,
  status: DesignStatus,
  at: number
): DesignChange<void> {
  if (!canTransitionDesign(design.status, status)) {
    throw new DesignRefusal('design_invalid_transition', 'design_invalid_transition')
  }
  return {
    // Why cleared: a completion only means something while the design is being implemented.
    patch: { status, inbox: withStatusItem(design, status, at), clearCompletion: true },
    event: { kind: 'status-changed', actor: 'user', detail: `${design.status} -> ${status}` },
    result: undefined
  }
}

export function requestCompletion(design: Design, summary: string, at: number): DesignChange<void> {
  if (design.status !== 'in-progress') {
    throw new DesignRefusal(
      'design_not_in_progress',
      `Design ${design.id} is ${design.status}; only an approved (in-progress) design can be reported complete.`
    )
  }
  const canvasVersion = latestDesignCanvas(design)?.version ?? null
  return {
    patch: { completion: { summary, at, canvasVersion } },
    event: {
      kind: 'completion-requested',
      actor: 'agent',
      detail: canvasVersion === null ? undefined : `v${canvasVersion}`
    },
    result: undefined
  }
}

function requirePendingCompletion(design: Design): void {
  if (design.completion === undefined) {
    throw new DesignRefusal(
      'design_no_completion',
      `Design ${design.id} has no completion from its agent to confirm or decline.`
    )
  }
}

export function confirmDone(design: Design, at: number): DesignChange<void> {
  requirePendingCompletion(design)
  return {
    patch: { status: 'done', inbox: withStatusItem(design, 'done', at), clearCompletion: true },
    event: { kind: 'completion-confirmed', actor: 'user', detail: `${design.status} -> done` },
    result: undefined
  }
}

/** The user's text becomes a general comment, so the agent reads what is left in its inbox. */
export function declineDone(design: Design, text: string, at: number): DesignChange<void> {
  requirePendingCompletion(design)
  const comment = addComment(design, { text }, at)
  return {
    patch: { ...comment.patch, clearCompletion: true },
    event: { kind: 'completion-declined', actor: 'user', detail: comment.result.id },
    result: undefined
  }
}
