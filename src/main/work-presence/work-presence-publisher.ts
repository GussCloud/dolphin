import type { WorkPresenceSnapshot } from './work-presence-snapshot'

export type WorkPresenceSendOutcome =
  | { status: 'ok'; heartbeatMs: number | null }
  | { status: 'no-organization' }
  | { status: 'signed-out' }
  | { status: 'failed' }

export type WorkPresencePublisherDeps = {
  buildSnapshot: () => Promise<WorkPresenceSnapshot>
  send: (snapshot: WorkPresenceSnapshot) => Promise<WorkPresenceSendOutcome>
  sendGoodbye: (machineId: string) => Promise<void>
}

export const WORK_PRESENCE_DEBOUNCE_MS = 1_000
export const WORK_PRESENCE_DEFAULT_HEARTBEAT_MS = 20_000
// Why 40s ceiling: the server marks a machine offline after 60s without a snapshot.
const MIN_HEARTBEAT_MS = 5_000
const MAX_HEARTBEAT_MS = 40_000
export const WORK_PRESENCE_IDLE_RECHECK_MS = 10 * 60_000
// Why 2s: four quick retries still land inside the server's offline window.
const FAILURE_BACKOFF_BASE_MS = 2_000
const FAILURE_BACKOFF_MAX_MS = 5 * 60_000

type PublishReason = 'change' | 'cycle'
type Mode = 'active' | 'backoff' | 'signed-out'

function heartbeatDelay(heartbeatMs: number | null): number {
  const value = heartbeatMs ?? WORK_PRESENCE_DEFAULT_HEARTBEAT_MS
  return Math.min(MAX_HEARTBEAT_MS, Math.max(MIN_HEARTBEAT_MS, value))
}

/** Schedules full-snapshot PUTs: debounced on change, on a heartbeat otherwise, backing off on failure. */
export class WorkPresencePublisher {
  private running = false
  private mode: Mode = 'active'
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private cycleTimer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private changedDuringFlight = false
  // A heartbeat that landed mid-publish; dropping it would end the heartbeat chain.
  private cycleDuringFlight = false
  private heartbeatMs: number | null = null
  private lastSentJson: string | null = null
  // Machine the server currently holds a snapshot for; DELETE targets it.
  private publishedMachineId: string | null = null
  private failures = 0
  private signingOut = false

  constructor(private readonly deps: WorkPresencePublisherDeps) {}

  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    this.mode = 'active'
    this.scheduleCycle(0)
  }

  notifyChange(): void {
    if (!this.running || this.mode !== 'active') {
      return
    }
    if (this.inFlight) {
      this.changedDuringFlight = true
      return
    }
    if (this.debounceTimer) {
      return
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.publish('change')
    }, WORK_PRESENCE_DEBOUNCE_MS)
  }

  /** A sign-in may have created the session or joined an organization; retry now. */
  resume(): void {
    if (!this.running) {
      return
    }
    this.mode = 'active'
    this.failures = 0
    this.scheduleCycle(0)
  }

  /** Says goodbye with the caller's session, which sign-out is about to revoke. */
  async signOut(goodbye: (machineId: string) => Promise<void>): Promise<void> {
    this.signingOut = true
    this.clearTimers()
    await this.inFlight
    await this.sayGoodbye(goodbye)
    this.signingOut = false
    this.mode = 'signed-out'
    if (this.running) {
      this.scheduleCycle(WORK_PRESENCE_IDLE_RECHECK_MS)
    }
  }

  async stop(): Promise<void> {
    this.running = false
    this.clearTimers()
    await this.inFlight
    await this.sayGoodbye(this.deps.sendGoodbye)
  }

  private async sayGoodbye(goodbye: (machineId: string) => Promise<void>): Promise<void> {
    const machineId = this.publishedMachineId
    this.publishedMachineId = null
    this.lastSentJson = null
    if (!machineId) {
      return
    }
    try {
      await goodbye(machineId)
    } catch {
      // Best-effort: the server drops a silent machine after its liveness window anyway.
    }
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer)
      this.cycleTimer = null
    }
  }

  private scheduleCycle(delayMs: number): void {
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer)
    }
    this.cycleTimer = setTimeout(() => {
      this.cycleTimer = null
      this.publish('cycle')
    }, delayMs)
    this.cycleTimer.unref?.()
  }

  private publish(reason: PublishReason): void {
    if (!this.running) {
      return
    }
    if (this.inFlight) {
      if (reason === 'cycle') {
        this.cycleDuringFlight = true
      } else {
        this.changedDuringFlight = true
      }
      return
    }
    this.inFlight = this.runPublish(reason).finally(() => {
      this.inFlight = null
      if (this.cycleDuringFlight) {
        // A cycle sends unconditionally, so it also covers any change seen meanwhile.
        this.cycleDuringFlight = false
        this.changedDuringFlight = false
        this.publish('cycle')
      } else if (this.changedDuringFlight) {
        this.changedDuringFlight = false
        this.notifyChange()
      }
    })
  }

  private async runPublish(reason: PublishReason): Promise<void> {
    let outcome: WorkPresenceSendOutcome
    let json = ''
    let machineId = ''
    try {
      const snapshot = await this.deps.buildSnapshot()
      json = JSON.stringify(snapshot)
      machineId = snapshot.machineId
      // Why: hook events fire per tool call while the visible state is unchanged; the heartbeat still renews.
      if (reason === 'change' && json === this.lastSentJson) {
        this.ensureHeartbeat()
        return
      }
      if (!this.running || this.signingOut) {
        return
      }
      outcome = await this.deps.send(snapshot)
    } catch {
      outcome = { status: 'failed' }
    }
    if (outcome.status === 'ok') {
      this.publishedMachineId = machineId
    }
    if (!this.running || this.signingOut) {
      return
    }
    this.applyOutcome(outcome, json)
  }

  /** Invariant: while active, some heartbeat is always pending. */
  private ensureHeartbeat(): void {
    if (this.running && this.mode === 'active' && !this.cycleTimer && !this.cycleDuringFlight) {
      this.scheduleCycle(heartbeatDelay(this.heartbeatMs))
    }
  }

  private applyOutcome(outcome: WorkPresenceSendOutcome, json: string): void {
    switch (outcome.status) {
      case 'ok':
        this.mode = 'active'
        this.failures = 0
        this.lastSentJson = json
        this.heartbeatMs = outcome.heartbeatMs
        this.scheduleCycle(heartbeatDelay(outcome.heartbeatMs))
        return
      case 'no-organization':
      case 'signed-out':
        this.mode = outcome.status === 'signed-out' ? 'signed-out' : 'backoff'
        this.publishedMachineId = null
        this.lastSentJson = null
        this.scheduleCycle(WORK_PRESENCE_IDLE_RECHECK_MS)
        return
      case 'failed':
        this.mode = 'backoff'
        this.failures += 1
        this.scheduleCycle(
          Math.min(FAILURE_BACKOFF_MAX_MS, FAILURE_BACKOFF_BASE_MS * 2 ** (this.failures - 1))
        )
    }
  }
}
