import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import {
  DESIGN_MAX_CANVAS_VERSIONS,
  DESIGN_MAX_EVENTS,
  isDesignDecisionOpen,
  latestDesignCanvas,
  type Design,
  type DesignCanvas,
  type DesignDecision,
  type DesignEvent,
  type DesignListEntry,
  type DesignMessage,
  type DesignStatus
} from '../../shared/design-types'
import {
  addComment,
  addDecisions,
  addReply,
  answerDecision,
  type DesignChange,
  type DesignDecisionInput,
  type DesignEventInput,
  type DesignPatch
} from './design-interaction'
import { reviseDecision } from './design-decision-revision'
import { ackInbox, markDeliveryBlocked, recordNudge, resendDelivery } from './design-inbox'
import {
  changeDesignStatus,
  confirmDone,
  declineDone,
  requestCompletion
} from './design-completion'
import { isStoredDesign, withValidHistory } from './design-store-validation'

const MAX_DESIGNS = 200

export type DesignCreate = Pick<Design, 'name' | 'request' | 'agent' | 'repoId'>

type DesignListener = (design: Design) => void

/** One small JSON file per host; the host that runs the design agent owns the design. */
export class DesignStore {
  private cache: Design[] | null = null
  private readonly listeners = new Set<DesignListener>()

  constructor(
    private readonly resolveFilePath: () => string,
    private readonly now: () => number = Date.now
  ) {}

  list(): Design[] {
    return [...this.read()]
  }

  get(id: string): Design | null {
    return this.read().find((design) => design.id === id) ?? null
  }

  create(input: DesignCreate): Design {
    const at = this.now()
    const design: Design = {
      ...input,
      id: randomUUID(),
      status: 'draft',
      worktreeId: null,
      paneKey: null,
      canvasVersions: [],
      events: [{ kind: 'created', at, actor: 'user' }],
      decisions: [],
      messages: [],
      inbox: [],
      delivery: { nudges: 0 },
      createdAt: at,
      updatedAt: at
    }
    this.write([...this.read(), design])
    this.emit(design)
    return design
  }

  bindAgent(id: string, binding: { paneKey: string; worktreeId: string | null }): Design {
    const design = this.require(id)
    const detail = design.paneKey && design.paneKey !== binding.paneKey ? 'rebound' : undefined
    return this.mutate(design, { ...binding }, { kind: 'agent-bound', actor: 'agent', detail })
  }

  setCanvas(id: string, canvas: DesignCanvas): { design: Design; version: number } {
    const design = this.require(id)
    const at = this.now()
    const version = (latestDesignCanvas(design)?.version ?? 0) + 1
    const canvasVersions = [...design.canvasVersions, { version, canvas, at }].slice(
      -DESIGN_MAX_CANVAS_VERSIONS
    )
    const next = this.mutate(
      design,
      { canvasVersions },
      { kind: 'canvas-set', actor: 'agent', detail: `v${version}` }
    )
    return { design: next, version }
  }

  /** The user's move; a bound agent is told through a 'status' inbox item. */
  setStatus(id: string, status: DesignStatus): Design {
    this.apply(id, (design, at) => changeDesignStatus(design, status, at))
    return this.require(id)
  }

  /** The agent reports the approved design implemented; a second report replaces the first. */
  complete(id: string, summary: string): Design {
    this.apply(id, (design, at) => requestCompletion(design, summary, at))
    return this.require(id)
  }

  confirmDone(id: string): Design {
    this.apply(id, (design, at) => confirmDone(design, at))
    return this.require(id)
  }

  declineDone(id: string, text: string): Design {
    this.apply(id, (design, at) => declineDone(design, text, at))
    return this.require(id)
  }

  rename(id: string, name: string): Design {
    return this.mutate(this.require(id), { name }, { kind: 'renamed', actor: 'user' })
  }

  addDecisions(id: string, inputs: DesignDecisionInput[]): DesignDecision[] {
    return this.apply(id, (design, at) => addDecisions(design, inputs, at))
  }

  answerDecision(
    id: string,
    answer: { decisionId: string; selected: string[]; note?: string | undefined }
  ): DesignDecision {
    return this.apply(id, (design, at) => answerDecision(design, answer, at))
  }

  reviseDecision(id: string, revision: { decisionId: string; text: string }): DesignDecision {
    return this.apply(id, (design, at) => reviseDecision(design, revision, at))
  }

  addComment(id: string, comment: { blockId?: string | undefined; text: string }): DesignMessage {
    return this.apply(id, (design, at) => addComment(design, comment, at))
  }

  addReply(
    id: string,
    reply: { replyTo?: string | undefined; blockId?: string | undefined; text: string }
  ): DesignMessage {
    return this.apply(id, (design, at) => addReply(design, reply, at))
  }

  /** Returns how many items were pending and are now acked. */
  ack(id: string, itemIds: string[]): number {
    return this.apply(id, (design, at) => ackInbox(design, itemIds, at))
  }

  recordNudge(id: string): number {
    return this.apply(id, (design, at) => recordNudge(design, at))
  }

  markDeliveryBlocked(id: string): void {
    this.apply(id, (design, at) => markDeliveryBlocked(design, at))
  }

  resend(id: string): void {
    this.apply(id, (design, at) => resendDelivery(design, at))
  }

  subscribe(listener: DesignListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private require(id: string): Design {
    const design = this.get(id)
    if (!design) {
      throw new Error('design_not_found')
    }
    return design
  }

  private apply<T>(id: string, change: (design: Design, at: number) => DesignChange<T>): T {
    const design = this.require(id)
    const { patch, event, result } = change(design, this.now())
    this.mutate(design, patch, event)
    return result
  }

  private mutate(design: Design, patch: DesignPatch, event: DesignEventInput): Design {
    const at = this.now()
    const logged: DesignEvent = {
      kind: event.kind,
      actor: event.actor,
      at,
      ...(event.detail ? { detail: event.detail } : {})
    }
    const { completion, clearCompletion, ...rest } = patch
    const { completion: previous, ...base } = design
    const kept = clearCompletion ? undefined : (completion ?? previous)
    const next: Design = {
      ...base,
      ...rest,
      ...(kept ? { completion: kept } : {}),
      events: [...design.events, logged].slice(-DESIGN_MAX_EVENTS),
      updatedAt: at
    }
    this.write(this.read().map((existing) => (existing.id === design.id ? next : existing)))
    this.emit(next)
    return next
  }

  private emit(design: Design): void {
    for (const listener of this.listeners) {
      try {
        listener(design)
      } catch (error) {
        console.error('[designs] listener threw', error)
      }
    }
  }

  private read(): Design[] {
    if (this.cache) {
      return this.cache
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.resolveFilePath(), 'utf-8'))
    } catch {
      parsed = []
    }
    this.cache = Array.isArray(parsed) ? parsed.filter(isStoredDesign).map(withValidHistory) : []
    return this.cache
  }

  private write(designs: Design[]): void {
    // Why: finished and discarded designs are history; drafts and in-progress ones are never evicted.
    const open = designs.filter(isDesignOpen)
    const closed = designs.filter((design) => !isDesignOpen(design))
    const kept = [...open, ...closed.slice(-Math.max(0, MAX_DESIGNS - open.length))].sort(
      (a, b) => a.createdAt - b.createdAt
    )
    writeFileAtomically(this.resolveFilePath(), JSON.stringify(kept), { mode: 0o600 })
    this.cache = kept
  }
}

function isDesignOpen(design: Design): boolean {
  return design.status === 'draft' || design.status === 'in-progress'
}

export function toDesignListEntry(design: Design): DesignListEntry {
  const {
    canvasVersions: _versions,
    events: _events,
    decisions,
    messages: _messages,
    inbox: _inbox,
    delivery,
    completion,
    ...entry
  } = design
  const latest = latestDesignCanvas(design)
  return {
    ...entry,
    canvasVersion: latest?.version ?? null,
    groupCount: latest?.canvas.groups.length ?? 0,
    openDecisionCount: decisions.filter(isDesignDecisionOpen).length,
    deliveryBlocked: delivery.blockedAt !== undefined,
    completionPending: completion !== undefined
  }
}
