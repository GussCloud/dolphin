// Tells a design's agent that the user answered, commented or moved the design. The content stays in the inbox; the
// agent is only typed a one-line pointer, and only while it is idle and the user is not drafting.
import { DESIGN_INBOX_MAX_NUDGES, pendingDesignInbox, type Design } from '../../shared/design-types'

/** Fallback cadence; new input is attempted at once through the store subscription. */
export const DESIGN_INBOX_CHECK_MS = 15_000
/** How long a nudge has to be acked before the next one is typed. */
export const DESIGN_INBOX_ACK_WAIT_MS = 60_000

export function buildDesignInboxNudge(designId: string): string {
  return `Dolphin Design: new input from the user. Run dolphin design inbox --id ${designId} --json, act on it, then ack.`
}

/** A discarded design still has its discard notice delivered; its other input no longer matters. */
function hasDeliverableInput(design: Design): boolean {
  const pending = pendingDesignInbox(design)
  return design.status === 'discarded'
    ? pending.some((item) => item.kind === 'status')
    : pending.length > 0
}

export type DesignInboxWatchdogPorts = {
  listDesigns: () => Design[]
  subscribe: (listener: () => void) => () => void
  resolveTerminalHandle: (paneKey: string) => string | null
  /** null is "could not read" (e.g. an SSH pane out of contact): unverifiable, so nothing is sent. */
  readAgentStatus: (terminal: string) => Promise<'working' | 'permission' | 'idle' | null>
  /** Last user input on the terminal from any surface; compared for equality only. */
  readLastInputAt: (terminal: string) => number | undefined
  /** Non-null while the user has a draft or is typing; the nudge then waits and is not counted. */
  readUserComposingWaitMs: (terminal: string) => number | null
  /** Types the nudge and submits it; false when it could not be written. */
  sendNudge: (terminal: string, text: string, designId: string) => Promise<boolean>
  recordNudge: (designId: string) => void
  markDeliveryBlocked: (designId: string) => void
  now?: () => number
  every?: (run: () => void, ms: number) => () => void
}

function defaultEvery(run: () => void, ms: number): () => void {
  const timer = setInterval(run, ms)
  return () => clearInterval(timer)
}

export function startDesignInboxWatchdog(ports: DesignInboxWatchdogPorts): {
  check: () => Promise<void>
  stop: () => void
} {
  const now = ports.now ?? Date.now
  const inputSeen = new Map<string, number | undefined>()
  let checking: Promise<void> | null = null
  let rerun = false

  async function checkDesign(design: Design, paneKey: string): Promise<void> {
    const { delivery } = design
    if (
      delivery.lastNudgeAt !== undefined &&
      now() - delivery.lastNudgeAt < DESIGN_INBOX_ACK_WAIT_MS
    ) {
      return
    }
    if (delivery.nudges >= DESIGN_INBOX_MAX_NUDGES) {
      ports.markDeliveryBlocked(design.id)
      return
    }
    const terminal = ports.resolveTerminalHandle(paneKey)
    if (!terminal) {
      return
    }
    // Why: the user typing into the agent's pane since the last look means they are talking to it.
    const inputAt = ports.readLastInputAt(terminal)
    const typed = inputSeen.has(paneKey) && inputSeen.get(paneKey) !== inputAt
    inputSeen.set(paneKey, inputAt)
    if (typed || ports.readUserComposingWaitMs(terminal) !== null) {
      return
    }
    if ((await ports.readAgentStatus(terminal)) !== 'idle') {
      return
    }
    if (await ports.sendNudge(terminal, buildDesignInboxNudge(design.id), design.id)) {
      ports.recordNudge(design.id)
    }
  }

  async function runChecks(): Promise<void> {
    const watched = new Set<string>()
    for (const design of ports.listDesigns()) {
      if (
        design.paneKey === null ||
        design.delivery.blockedAt !== undefined ||
        !hasDeliverableInput(design)
      ) {
        continue
      }
      watched.add(design.paneKey)
      try {
        await checkDesign(design, design.paneKey)
      } catch (error) {
        console.warn('[designs] inbox watchdog check failed', error)
      }
    }
    for (const paneKey of inputSeen.keys()) {
      if (!watched.has(paneKey)) {
        inputSeen.delete(paneKey)
      }
    }
  }

  /** A store change during a pass runs one more pass, so a fresh comment is never left for the tick. */
  function check(): Promise<void> {
    if (checking) {
      rerun = true
      return checking
    }
    checking = (async () => {
      try {
        do {
          rerun = false
          await runChecks()
        } while (rerun)
      } finally {
        checking = null
      }
    })()
    return checking
  }

  const unsubscribe = ports.subscribe(() => void check())
  const stopTimer = (ports.every ?? defaultEvery)(() => void check(), DESIGN_INBOX_CHECK_MS)
  return {
    check,
    stop: () => {
      unsubscribe()
      stopTimer()
    }
  }
}
