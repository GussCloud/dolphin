import {
  canTransitionSessionLifecycle,
  isSessionLifecycleFinished,
  type SessionLifecycleState
} from '../../shared/session-lifecycle'

export type SessionLifecycleTransition = { state: SessionLifecycleState; at: number }

export type SessionLifecycleRecord = {
  sessionId: string
  state: SessionLifecycleState
  transitions: SessionLifecycleTransition[]
  /** Transitions refused by the state machine; nonzero means some layer disagrees about this session. */
  rejectedTransitions: number
}

// Why bounded: finished records are kept only so diagnostics can show recent teardowns.
const MAX_FINISHED_RECORDS = 200
const MAX_TRANSITIONS_PER_RECORD = 16

/**
 * Records every lifecycle transition main observes for a session, refusing ones the state machine
 * forbids instead of throwing, so repeated or late signals (a second stop, an exit after reap)
 * stay harmless.
 */
export class SessionLifecycleLedger {
  private readonly records = new Map<string, SessionLifecycleRecord>()
  private readonly finishedOrder: string[] = []

  constructor(private readonly now: () => number = Date.now) {}

  /** Returns false when the transition was refused; the record keeps its prior state. */
  transition(sessionId: string, to: SessionLifecycleState): boolean {
    const existing = this.records.get(sessionId)
    if (!existing) {
      this.records.set(sessionId, {
        sessionId,
        state: to,
        transitions: [{ state: to, at: this.now() }],
        rejectedTransitions: 0
      })
      this.noteFinished(sessionId, to)
      return true
    }
    if (existing.state === to) {
      return true
    }
    // Why: a finished id reused by a fresh spawn is a new life, not a forbidden resurrection.
    if (isSessionLifecycleFinished(existing.state) && (to === 'creating' || to === 'running')) {
      this.forget(sessionId)
      return this.transition(sessionId, to)
    }
    if (!canTransitionSessionLifecycle(existing.state, to)) {
      existing.rejectedTransitions += 1
      return false
    }
    existing.state = to
    existing.transitions.push({ state: to, at: this.now() })
    if (existing.transitions.length > MAX_TRANSITIONS_PER_RECORD) {
      existing.transitions.splice(1, existing.transitions.length - MAX_TRANSITIONS_PER_RECORD)
    }
    this.noteFinished(sessionId, to)
    return true
  }

  get(sessionId: string): SessionLifecycleRecord | undefined {
    return this.records.get(sessionId)
  }

  list(): SessionLifecycleRecord[] {
    return [...this.records.values()]
  }

  countByState(): Partial<Record<SessionLifecycleState, number>> {
    const counts: Partial<Record<SessionLifecycleState, number>> = {}
    for (const record of this.records.values()) {
      counts[record.state] = (counts[record.state] ?? 0) + 1
    }
    return counts
  }

  private noteFinished(sessionId: string, state: SessionLifecycleState): void {
    if (state !== 'reaped') {
      return
    }
    this.finishedOrder.push(sessionId)
    while (this.finishedOrder.length > MAX_FINISHED_RECORDS) {
      const evicted = this.finishedOrder.shift()
      if (evicted !== undefined && this.records.get(evicted)?.state === 'reaped') {
        this.records.delete(evicted)
      }
    }
  }

  private forget(sessionId: string): void {
    this.records.delete(sessionId)
    const index = this.finishedOrder.indexOf(sessionId)
    if (index !== -1) {
      this.finishedOrder.splice(index, 1)
    }
  }
}

/** Main's ledger for local PTY sessions, fed by the memory-collector PTY registry. */
export const localPtySessionLifecycle = new SessionLifecycleLedger()
