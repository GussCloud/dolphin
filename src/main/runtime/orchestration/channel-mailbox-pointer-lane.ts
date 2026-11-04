/**
 * Hands a coordinator its mailbox pointer through its Claude Code channel instead of typing it.
 * Claude registers a channel silently or not at all (org policy, non-first-party provider), so a
 * push is only a claim until the coordinator reads the mail it announced; a push left unread past
 * the grace period retires the channel for that session and the typed path takes over.
 */
import type { OrchestrationDb } from './db'
import type { OrchestrationMailboxLeaf } from './mailbox-owner'

export type OrchestrationPointerChannel = {
  /** The live channel session in the pane, or null when none is polling. */
  connectedSessionId: (paneKey: string) => string | null
  push: (paneKey: string, text: string) => Promise<'delivered' | 'not-connected' | 'unconfirmed'>
}

export type OrchestrationChannelPointerBatch = { messageIds: string[]; text: string }

type SessionState = {
  sessionId: string
  proven: boolean
  failed: boolean
  inFlight: boolean
  pending: { mailboxHandle: string; messageIds: string[]; pushedAt: number } | null
}

/** Matches the mail watchdog's stranded threshold, which nudges by typing after it. */
export const ORCHESTRATION_CHANNEL_POINTER_GRACE_MS = 60_000
const MAX_TRACKED_PANES = 256

export class OrchestrationChannelPointerLane {
  private readonly sessions = new Map<string, SessionState>()
  private readonly now: () => number
  private readonly graceMs: number

  constructor(
    private readonly deps: {
      channel: OrchestrationPointerChannel
      getDb: () => OrchestrationDb | null
      resolvePaneKey: (leaf: OrchestrationMailboxLeaf) => string | null | undefined
      /** Re-offers the mailbox, e.g. to the typed path once the channel turned out absent. */
      redrive: (mailboxHandle: string) => void
      now?: () => number
      graceMs?: number
    }
  ) {
    this.now = deps.now ?? Date.now
    this.graceMs = deps.graceMs ?? ORCHESTRATION_CHANNEL_POINTER_GRACE_MS
  }

  /**
   * True when the channel owns this delivery (pushed now, or an earlier push is still within its
   * grace); false when the caller must type the pointer instead.
   */
  offer(
    leaf: OrchestrationMailboxLeaf,
    mailboxHandle: string,
    buildBatch: () => OrchestrationChannelPointerBatch | null
  ): boolean {
    const paneKey = this.deps.resolvePaneKey(leaf)
    const sessionId = paneKey ? this.deps.channel.connectedSessionId(paneKey) : null
    const db = this.deps.getDb()
    if (!paneKey || !sessionId || !db) {
      return false
    }
    const state = this.stateFor(paneKey, sessionId)
    if (state.failed) {
      return false
    }
    if (state.inFlight) {
      return true
    }
    if (state.pending) {
      if (!db.areUnreadMessages(state.pending.mailboxHandle, state.pending.messageIds)) {
        state.proven = true
        state.pending = null
      } else if (this.now() - state.pending.pushedAt >= this.graceMs) {
        console.warn('[orchestration-channel] pointer left unread; typing pointers in', paneKey)
        state.failed = true
        state.pending = null
        return false
      } else {
        return true
      }
    }
    const batch = buildBatch()
    if (!batch || batch.messageIds.length === 0) {
      return true
    }
    this.push(paneKey, state, mailboxHandle, batch)
    return true
  }

  private push(
    paneKey: string,
    state: SessionState,
    mailboxHandle: string,
    batch: OrchestrationChannelPointerBatch
  ): void {
    state.inFlight = true
    state.pending = { mailboxHandle, messageIds: batch.messageIds, pushedAt: this.now() }
    const settle = (outcome: 'delivered' | 'not-connected' | 'unconfirmed'): void => {
      state.inFlight = false
      if (outcome === 'not-connected') {
        state.pending = null
        this.deps.redrive(mailboxHandle)
        return
      }
      // Why only once proven: unproven rows stay undelivered, so the typed path can still take them.
      if (outcome === 'delivered' && state.proven) {
        this.deps.getDb()?.markAsDelivered(batch.messageIds)
      }
    }
    this.deps.channel.push(paneKey, batch.text).then(settle, () => settle('not-connected'))
  }

  private stateFor(paneKey: string, sessionId: string): SessionState {
    const existing = this.sessions.get(paneKey)
    if (existing?.sessionId === sessionId) {
      return existing
    }
    // Why reset: a relaunched `claude` is a new registration, which may succeed where one failed.
    const state: SessionState = {
      sessionId,
      proven: false,
      failed: false,
      inFlight: false,
      pending: null
    }
    this.sessions.delete(paneKey)
    this.sessions.set(paneKey, state)
    if (this.sessions.size > MAX_TRACKED_PANES) {
      const oldest = this.sessions.keys().next().value
      if (oldest !== undefined) {
        this.sessions.delete(oldest)
      }
    }
    return state
  }
}
