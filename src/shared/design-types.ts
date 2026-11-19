// A Design: a feature the user describes, which an agent turns into an interactive flow canvas before
// it is built. The host that runs the agent owns the record, the same way it owns an autonomous goal.

export const DESIGN_STATUSES = ['draft', 'in-progress', 'done', 'discarded'] as const
export type DesignStatus = (typeof DESIGN_STATUSES)[number]

export function isDesignStatus(value: unknown): value is DesignStatus {
  return DESIGN_STATUSES.some((status) => status === value)
}

/** Allowed status moves; anything else is refused by the host. */
export const DESIGN_STATUS_TRANSITIONS: Record<DesignStatus, readonly DesignStatus[]> = {
  draft: ['in-progress', 'discarded'],
  'in-progress': ['done', 'discarded', 'draft'],
  done: ['in-progress'],
  discarded: ['draft']
}

export function canTransitionDesign(from: DesignStatus, to: DesignStatus): boolean {
  return DESIGN_STATUS_TRANSITIONS[from].includes(to)
}

export const DESIGN_BLOCK_KINDS = [
  'trigger',
  'screen',
  'action',
  'decision',
  'data',
  'integration',
  'note'
] as const
export type DesignBlockKind = (typeof DESIGN_BLOCK_KINDS)[number]

export const DESIGN_NAME_MAX_CHARS = 120
export const DESIGN_REQUEST_MAX_CHARS = 8_000
export const DESIGN_CANVAS_MAX_GROUPS = 60
export const DESIGN_CANVAS_MAX_BLOCKS_PER_GROUP = 20
export const DESIGN_CANVAS_MAX_EDGES = 200
export const DESIGN_TEXT_MAX_CHARS = 1_500
export const DESIGN_SUMMARY_MAX_CHARS = 2_000
/** Canvas versions kept per design; older ones age out so the store stays bounded. */
export const DESIGN_MAX_CANVAS_VERSIONS = 20
export const DESIGN_MAX_EVENTS = 500

export type DesignBlock = {
  id: string
  kind: DesignBlockKind
  title: string
  description?: string
}

/** A card on the canvas: a step of the flow holding stacked blocks. */
export type DesignGroup = {
  id: string
  title: string
  blocks: DesignBlock[]
  /** Optional agent-chosen position; absent groups are laid out automatically. */
  position?: { x: number; y: number }
}

/** From a block (or a whole group) to the group the flow continues in. */
export type DesignEdge = {
  id: string
  fromGroupId: string
  fromBlockId?: string
  toGroupId: string
  label?: string
}

export type DesignCanvas = {
  groups: DesignGroup[]
  edges: DesignEdge[]
  summary?: string
}

export type DesignCanvasVersion = {
  version: number
  canvas: DesignCanvas
  at: number
}

export const DESIGN_EVENT_KINDS = [
  'created',
  'agent-bound',
  'canvas-set',
  'status-changed',
  'renamed'
] as const
export type DesignEventKind = (typeof DESIGN_EVENT_KINDS)[number]

/** Append-only audit trail of everything that happened to a design. */
export type DesignEvent = {
  kind: DesignEventKind
  at: number
  actor: 'user' | 'agent'
  detail?: string
}

export type Design = {
  id: string
  name: string
  /** What the user asked to build, verbatim. */
  request: string
  status: DesignStatus
  /** Agent catalog id the design was launched with (e.g. 'claude'). */
  agent: string
  repoId: string | null
  /** Bound by the agent's first `dolphin design` call from its pane, not by the composer. */
  worktreeId: string | null
  paneKey: string | null
  /** Newest last; the last entry is the canvas the UI shows. */
  canvasVersions: DesignCanvasVersion[]
  events: DesignEvent[]
  createdAt: number
  updatedAt: number
}

/** List rows skip canvas history and events so `design.list` stays small. */
export type DesignListEntry = Omit<Design, 'canvasVersions' | 'events'> & {
  canvasVersion: number | null
  groupCount: number
}

export function latestDesignCanvas(
  design: Pick<Design, 'canvasVersions'>
): DesignCanvasVersion | null {
  return design.canvasVersions.at(-1) ?? null
}
