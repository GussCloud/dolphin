import {
  AgentInteractionCueQueue,
  pickAgentInteractionKind,
  type AgentInteractionCue,
  type AgentInteractionCueView
} from '../../shared/agent-interaction-cue-queue'
import type {
  AgentInteractionKind,
  AgentInteractionSettings
} from '../../shared/agent-interaction-settings'
import {
  classifyAgentInteractionTransition,
  type AgentInteractionStatusRow
} from '../../shared/agent-interaction-transition'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'

/** Panes mirrored for transition diffs; matches the session recorder's bound. */
const MIRROR_LIMIT = 1000

export type AgentInteractionAnnouncement = {
  view: AgentInteractionCueView
  /** Set only when a new cue arrived; a re-render after an acknowledgement stays silent. */
  soundKind?: AgentInteractionKind
}

/** The window side of the feature; the controller never touches Electron itself. */
export type AgentInteractionPresenter = {
  present: (announcement: AgentInteractionAnnouncement) => void
  hide: () => void
}

export type AgentInteractionControllerDeps = {
  getSettings: () => {
    agentInteraction: AgentInteractionSettings
    claudeAutoRetryOnConnectionLoss?: boolean
  }
  resolveWorkspaceLabel: (worktreeId: string) => string | null
  /** Whether the main window has focus, so a workspace it shows is actually being looked at. */
  isMainWindowFocused: () => boolean
  presenter: AgentInteractionPresenter
  now?: () => number
}

type MirroredRow = AgentInteractionStatusRow & { worktreeId?: string }

function rowFromEnriched(event: EnrichedAgentHookEventPayload): MirroredRow {
  const { payload } = event
  return {
    state: payload.state,
    stateStartedAt: event.stateStartedAt,
    workingMode: payload.workingMode,
    interactivePrompt: payload.interactivePrompt,
    interrupted: payload.interrupted,
    sessionBoundary: payload.sessionBoundary,
    mainAgent: payload.mainAgent,
    subagents: payload.subagents,
    restoredUnconfirmed: event.restoredUnconfirmed,
    worktreeId: event.worktreeId
  }
}

function rowFromSnapshot(row: AgentStatusIpcPayload): MirroredRow {
  return {
    state: row.state,
    stateStartedAt: row.stateStartedAt,
    workingMode: row.workingMode,
    interactivePrompt: row.interactivePrompt,
    interrupted: row.interrupted,
    sessionBoundary: row.sessionBoundary,
    mainAgent: row.mainAgent,
    subagents: row.subagents,
    worktreeId: row.worktreeId
  }
}

/**
 * Turns status-store writes into avatar cues. Owns the previous-row mirror (the store hands
 * subscribers only the new row) and the cue queue; presentation is delegated.
 */
export class AgentInteractionController {
  private readonly mirror = new Map<string, MirroredRow>()
  private readonly queue = new AgentInteractionCueQueue()
  private readonly now: () => number
  private viewedWorktreeIds: ReadonlySet<string> = new Set()

  constructor(private readonly deps: AgentInteractionControllerDeps) {
    this.now = deps.now ?? Date.now
  }

  /** Seeds the mirror from the store so rows already live at startup are never announced. */
  seed(rows: readonly AgentStatusIpcPayload[]): void {
    for (const row of rows) {
      if (!row.providerSessionOnly) {
        this.remember(row.paneKey, rowFromSnapshot(row))
      }
    }
  }

  onStatus(event: EnrichedAgentHookEventPayload): void {
    if (event.providerSessionOnly) {
      return
    }
    const previous = this.mirror.get(event.paneKey)
    const next = rowFromEnriched(event)
    this.remember(event.paneKey, next)
    const settings = this.deps.getSettings()
    const config = settings.agentInteraction
    if (!config.enabled) {
      return
    }
    const settled = this.queue.reconcile(event.paneKey, next.state)
    // Why: a relay replay restates the past; the mirror takes it, the user hears nothing.
    const kinds = event.isReplay
      ? []
      : classifyAgentInteractionTransition(previous, next, {
          autoRetryEnabled: settings.claudeAutoRetryOnConnectionLoss
        }).filter((kind) => config.events[kind].enabled)
    const kind = pickAgentInteractionKind(kinds)
    if (kind) {
      this.announce({
        kind,
        paneKey: event.paneKey,
        worktreeId: event.worktreeId,
        agentType: event.payload.agentType,
        surface: event.structuredHost ? 'agent-session' : 'terminal'
      })
      return
    }
    if (settled) {
      this.render()
    }
  }

  /** Auto-retry gave up; it has no status write of its own to classify. */
  onRetryExhausted(event: { paneKey: string; worktreeId?: string }): void {
    const config = this.deps.getSettings().agentInteraction
    if (config.enabled && config.events['retry-exhausted'].enabled) {
      this.announce({ kind: 'retry-exhausted', agentType: 'claude', ...event })
    }
  }

  /** The row is gone (pane closed or dismissed); so is anything it asked for. */
  onPaneCleared(paneKey: string): void {
    this.mirror.delete(paneKey)
    if (this.queue.remove(paneKey)) {
      this.render()
    }
  }

  acknowledge(scope: { paneKeys?: readonly string[]; worktreeId?: string }): void {
    if (this.queue.acknowledge(scope)) {
      this.render()
    }
  }

  dismiss(paneKey: string): void {
    if (this.queue.remove(paneKey)) {
      this.render()
    }
  }

  /** The main window now shows these workspaces; opening one answers the cues it raised. */
  setViewedWorktrees(worktreeIds: readonly string[]): void {
    this.viewedWorktreeIds = new Set(worktreeIds)
    let changed = false
    for (const worktreeId of worktreeIds) {
      changed = this.queue.acknowledge({ worktreeId }) || changed
    }
    if (changed) {
      this.render()
    }
  }

  dismissAll(): void {
    if (this.queue.clear()) {
      this.render()
    }
  }

  onSettingsChanged(): void {
    if (!this.deps.getSettings().agentInteraction.enabled && this.queue.clear()) {
      this.render()
    }
  }

  current(): AgentInteractionCueView | null {
    return this.queue.current()
  }

  private announce(fields: Omit<AgentInteractionCue, 'createdAt' | 'workspaceLabel'>): void {
    // Why: the user is already looking at this workspace; a corner card would only repeat it.
    if (
      fields.worktreeId !== undefined &&
      this.viewedWorktreeIds.has(fields.worktreeId) &&
      this.deps.isMainWindowFocused()
    ) {
      return
    }
    const workspaceLabel = fields.worktreeId
      ? this.deps.resolveWorkspaceLabel(fields.worktreeId)
      : null
    this.queue.push({
      ...fields,
      ...(workspaceLabel ? { workspaceLabel } : {}),
      createdAt: this.now()
    })
    const view = this.queue.current()
    if (view) {
      this.deps.presenter.present({ view, soundKind: fields.kind })
    }
  }

  private render(): void {
    const view = this.queue.current()
    if (view) {
      this.deps.presenter.present({ view })
    } else {
      this.deps.presenter.hide()
    }
  }

  private remember(paneKey: string, row: MirroredRow): void {
    // Why delete-then-set: Map order doubles as recency for the LRU bound.
    this.mirror.delete(paneKey)
    this.mirror.set(paneKey, row)
    if (this.mirror.size > MIRROR_LIMIT) {
      const oldest = this.mirror.keys().next().value
      if (oldest !== undefined) {
        this.mirror.delete(oldest)
      }
    }
  }
}
