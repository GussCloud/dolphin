import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { DesignCanvasSchema } from '../../shared/rpc-contract/design-params'
import {
  DESIGN_EVENT_KINDS,
  DESIGN_MAX_CANVAS_VERSIONS,
  DESIGN_MAX_EVENTS,
  canTransitionDesign,
  isDesignStatus,
  latestDesignCanvas,
  type Design,
  type DesignCanvas,
  type DesignCanvasVersion,
  type DesignEvent,
  type DesignListEntry,
  type DesignStatus
} from '../../shared/design-types'

const MAX_DESIGNS = 200

export type DesignCreate = Pick<Design, 'name' | 'request' | 'agent' | 'repoId'>

type DesignListener = (design: Design) => void
type DesignActor = DesignEvent['actor']

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

  setStatus(id: string, status: DesignStatus, actor: DesignActor): Design {
    const design = this.require(id)
    if (!canTransitionDesign(design.status, status)) {
      throw new Error('design_invalid_transition')
    }
    return this.mutate(
      design,
      { status },
      { kind: 'status-changed', actor, detail: `${design.status} -> ${status}` }
    )
  }

  rename(id: string, name: string): Design {
    return this.mutate(this.require(id), { name }, { kind: 'renamed', actor: 'user' })
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

  private mutate(
    design: Design,
    patch: Partial<Pick<Design, 'name' | 'status' | 'paneKey' | 'worktreeId' | 'canvasVersions'>>,
    event: Omit<DesignEvent, 'at' | 'detail'> & { detail?: string | undefined }
  ): Design {
    const at = this.now()
    const logged: DesignEvent = {
      kind: event.kind,
      actor: event.actor,
      at,
      ...(event.detail ? { detail: event.detail } : {})
    }
    const next: Design = {
      ...design,
      ...patch,
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
  const { canvasVersions: _versions, events: _events, ...entry } = design
  const latest = latestDesignCanvas(design)
  return {
    ...entry,
    canvasVersion: latest?.version ?? null,
    groupCount: latest?.canvas.groups.length ?? 0
  }
}

/** A bad history entry is dropped on its own; the design and its other versions survive. */
function withValidHistory(design: Design): Design {
  const canvasVersions: DesignCanvasVersion[] = []
  for (const entry of design.canvasVersions) {
    const version = toStoredCanvasVersion(entry)
    if (version) {
      canvasVersions.push(version)
    }
  }
  return { ...design, canvasVersions, events: design.events.filter(isStoredEvent) }
}

function toStoredCanvasVersion(value: unknown): DesignCanvasVersion | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !('at' in value) ||
    typeof value.at !== 'number' ||
    !('canvas' in value)
  ) {
    return null
  }
  const canvas = DesignCanvasSchema.safeParse(value.canvas)
  return canvas.success ? { version: value.version, at: value.at, canvas: canvas.data } : null
}

function isStoredEvent(value: unknown): value is DesignEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    DESIGN_EVENT_KINDS.some((kind) => kind === value.kind) &&
    'actor' in value &&
    (value.actor === 'user' || value.actor === 'agent') &&
    'at' in value &&
    typeof value.at === 'number' &&
    (!('detail' in value) || typeof value.detail === 'string')
  )
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string'
}

function isStoredDesign(value: unknown): value is Design {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'request' in value &&
    typeof value.request === 'string' &&
    'status' in value &&
    isDesignStatus(value.status) &&
    'agent' in value &&
    typeof value.agent === 'string' &&
    'repoId' in value &&
    isNullableString(value.repoId) &&
    'worktreeId' in value &&
    isNullableString(value.worktreeId) &&
    'paneKey' in value &&
    isNullableString(value.paneKey) &&
    'canvasVersions' in value &&
    Array.isArray(value.canvasVersions) &&
    'events' in value &&
    Array.isArray(value.events) &&
    'createdAt' in value &&
    typeof value.createdAt === 'number' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  )
}
