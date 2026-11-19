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
  'renamed',
  'decision-asked',
  'decision-answered',
  'comment-added',
  'agent-replied',
  'inbox-nudged',
  'inbox-acked',
  'delivery-blocked',
  'delivery-resent',
  'completion-requested',
  'completion-confirmed',
  'completion-declined'
] as const
export type DesignEventKind = (typeof DESIGN_EVENT_KINDS)[number]

/** Append-only audit trail of everything that happened to a design. */
export type DesignEvent = {
  kind: DesignEventKind
  at: number
  /** 'dolphin' is the host itself: inbox nudges and delivery verdicts. */
  actor: 'user' | 'agent' | 'dolphin'
  detail?: string
}

export const DESIGN_DECISION_MAX_OPTIONS = 6
export const DESIGN_DECISION_MAX_OPEN = 10
export const DESIGN_MAX_MESSAGES = 300
export const DESIGN_MESSAGE_MAX_CHARS = 4_000
/** Unacked nudges before delivery counts as blocked and the UI offers a manual resend. */
export const DESIGN_INBOX_MAX_NUDGES = 3

export type DesignDecisionOption = { label: string; description?: string }

/** A question the agent needs the user to settle; shaped like Claude's AskUserQuestion. */
export type DesignDecision = {
  id: string
  question: string
  header?: string
  options: DesignDecisionOption[]
  multiSelect: boolean
  /** The block the question is about, when it is about one. */
  blockId?: string
  askedAt: number
  answer?: { selected: string[]; note?: string; at: number }
}

/** A message in a block's thread (blockId set) or the design's general thread. */
export type DesignMessage = {
  id: string
  author: 'user' | 'agent'
  text: string
  blockId?: string
  /** The user message an agent reply answers. */
  replyTo?: string
  at: number
}

/** 'status' tells the agent the user moved the design (approved, discarded, reopened). */
export const DESIGN_INBOX_KINDS = ['answer', 'comment', 'status'] as const
export type DesignInboxKind = (typeof DESIGN_INBOX_KINDS)[number]

/** User input waiting for the agent: the content stays here, the agent is only nudged to read it. */
export type DesignInboxItem = {
  id: string
  kind: DesignInboxKind
  /** Decision id for 'answer', message id for 'comment', the new status for 'status'. */
  refId: string
  /** For 'status' → in-progress: the canvas version the user approved. */
  canvasVersion?: number
  createdAt: number
  ackedAt?: number
}

export type DesignDelivery = {
  /** Nudges typed since the last ack. */
  nudges: number
  lastNudgeAt?: number
  /** Set after DESIGN_INBOX_MAX_NUDGES unacked nudges; cleared by an ack or a manual resend. */
  blockedAt?: number
  /** One-shot manual resend: the next nudge may be typed without an idle status. Cleared by any nudge or ack. */
  forceRequestedAt?: number
}

/** Pending this long with no nudge typed suggests an agent that never reports idle. */
export const DESIGN_INBOX_UNNOTIFIED_HINT_MS = 120_000

export const DESIGN_COMPLETION_SUMMARY_MAX_CHARS = 4_000

export type DesignCompletion = {
  summary: string
  at: number
  /** The approved canvas version the agent implemented. */
  canvasVersion: number | null
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
  decisions: DesignDecision[]
  messages: DesignMessage[]
  inbox: DesignInboxItem[]
  delivery: DesignDelivery
  /** The agent says the approved design is implemented; the user confirms (→ done) or declines. */
  completion?: DesignCompletion
  createdAt: number
  updatedAt: number
}

/** List rows skip canvas history and events so `design.list` stays small. */
export type DesignListEntry = Omit<
  Design,
  'canvasVersions' | 'events' | 'decisions' | 'messages' | 'inbox' | 'delivery' | 'completion'
> & {
  canvasVersion: number | null
  groupCount: number
  openDecisionCount: number
  deliveryBlocked: boolean
  completionPending: boolean
}

/** What `design.inbox` returns per pending item: the referenced content, resolved for the agent. */
export type DesignInboxEntry = {
  id: string
  createdAt: number
  /** Set when the item is about a block; `title` is absent once the latest canvas drops that block. */
  block?: { id: string; title?: string }
} & (
  | {
      kind: 'answer'
      decisionId: string
      question: string
      selected: string[]
      note?: string
    }
  | { kind: 'comment'; messageId: string; text: string }
  /** `text` is what the agent must do now that the user moved the design. */
  | { kind: 'status'; status: DesignStatus; canvasVersion?: number; text: string }
)

export function isDesignDecisionOpen(decision: Pick<DesignDecision, 'answer'>): boolean {
  return decision.answer === undefined
}

export function pendingDesignInbox(design: Pick<Design, 'inbox'>): DesignInboxItem[] {
  return design.inbox.filter((item) => item.ackedAt === undefined)
}

export function latestDesignCanvas(
  design: Pick<Design, 'canvasVersions'>
): DesignCanvasVersion | null {
  return design.canvasVersions.at(-1) ?? null
}
