import type { AgentInteractionKind } from './agent-interaction-settings'
import type { AgentStatusState } from './agent-status-types'

/** One request for the user's attention, as the avatar presents it. */
export type AgentInteractionCue = {
  kind: AgentInteractionKind
  paneKey: string
  worktreeId?: string
  /** Repo/worktree name the user recognizes; absent when the host could not resolve one. */
  workspaceLabel?: string
  agentType?: string
  /** `agent-session` cues open a native chat tab rather than a terminal pane. */
  surface?: 'terminal' | 'agent-session'
  createdAt: number
}

export type AgentInteractionCueView = {
  cue: AgentInteractionCue
  /** Other panes still waiting behind the one shown. */
  pendingCount: number
}

/** Most urgent first; when one write earns several events the avatar announces this one. */
const KIND_PRIORITY: Readonly<Record<AgentInteractionKind, number>> = {
  'needs-permission': 0,
  'needs-input': 1,
  'task-failed': 2,
  'retry-exhausted': 3,
  'subagent-attention': 4,
  'task-done': 5,
  'task-interrupted': 6,
  'subagent-done': 7,
  'task-started': 8
}

export function pickAgentInteractionKind(
  kinds: readonly AgentInteractionKind[]
): AgentInteractionKind | null {
  let best: AgentInteractionKind | null = null
  for (const kind of kinds) {
    if (best === null || KIND_PRIORITY[kind] < KIND_PRIORITY[best]) {
      best = kind
    }
  }
  return best
}

/** A cue that asks for an answer is moot once the agent stops waiting for one. */
function isCueStillPending(kind: AgentInteractionKind, state: AgentStatusState): boolean {
  if (kind === 'needs-permission') {
    return state === 'blocked'
  }
  if (kind === 'needs-input') {
    return state === 'waiting' || state === 'blocked'
  }
  // Why: a new turn supersedes the previous turn's outcome; the user has moved on.
  if (kind === 'task-done' || kind === 'task-failed' || kind === 'task-interrupted') {
    return state !== 'working'
  }
  return true
}

/**
 * At most one cue per pane, newest on top. Pure bookkeeping: callers own clocks and presentation.
 */
export class AgentInteractionCueQueue {
  private readonly cues = new Map<string, AgentInteractionCue>()

  /** Replaces the pane's previous cue, so a pane never stacks stale requests. */
  push(cue: AgentInteractionCue): void {
    this.cues.delete(cue.paneKey)
    this.cues.set(cue.paneKey, cue)
  }

  /** Drops the pane's cue when its row has moved past what the cue asked for. */
  reconcile(paneKey: string, state: AgentStatusState): boolean {
    const cue = this.cues.get(paneKey)
    if (!cue || isCueStillPending(cue.kind, state)) {
      return false
    }
    return this.cues.delete(paneKey)
  }

  /** The user opened these panes or this workspace, so their cues are answered. */
  acknowledge(scope: { paneKeys?: readonly string[]; worktreeId?: string }): boolean {
    let changed = false
    for (const paneKey of scope.paneKeys ?? []) {
      changed = this.cues.delete(paneKey) || changed
    }
    if (scope.worktreeId !== undefined) {
      for (const [paneKey, cue] of this.cues) {
        if (cue.worktreeId === scope.worktreeId) {
          changed = this.cues.delete(paneKey) || changed
        }
      }
    }
    return changed
  }

  remove(paneKey: string): boolean {
    return this.cues.delete(paneKey)
  }

  clear(): boolean {
    const changed = this.cues.size > 0
    this.cues.clear()
    return changed
  }

  current(): AgentInteractionCueView | null {
    let newest: AgentInteractionCue | null = null
    for (const cue of this.cues.values()) {
      newest = cue
    }
    return newest ? { cue: newest, pendingCount: this.cues.size - 1 } : null
  }
}
