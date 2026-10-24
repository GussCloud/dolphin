// Wakes a goal coordinator that sits idle over unread Run mail. The pointer path stays silent while a
// delivery is unacked and never re-sends a pointer whose Enter was dropped, and a coordinator never
// polls, so without this a finished worker can wait until the user asks for status.
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import { AUTONOMOUS_COORDINATOR_MAIL_NUDGE } from '../../shared/autonomous-coordinator-prompt'

/** How often open goals are checked; a local DB read, no model call. */
export const AUTONOMOUS_GOAL_MAIL_CHECK_MS = 30_000
/** Mail unread this long while the coordinator is idle counts as stranded. */
export const AUTONOMOUS_GOAL_MAIL_STRANDED_MS = 60_000
export const AUTONOMOUS_GOAL_MAIL_RENUDGE_MS = 5 * 60_000
/** After this many unanswered nudges the goal is marked blocked for the user. */
export const AUTONOMOUS_GOAL_MAIL_MAX_NUDGES = 3

export type AutonomousGoalMailWatchdogPorts = {
  listGoals: () => AutonomousGoal[]
  /** The oldest unread Run message id, or null when the mailbox is drained. */
  oldestUnreadRunMessageId: (runId: string) => string | null
  resolveTerminalHandle: (paneKey: string) => string | null
  readAgentStatus: (terminal: string) => Promise<'working' | 'permission' | 'idle' | null>
  /** Last user input on the terminal from any surface; compared for equality only. */
  readLastInputAt: (terminal: string) => number | undefined
  /** Types the nudge and submits it; false when it could not be written. */
  sendNudge: (terminal: string, text: string) => Promise<boolean>
  markBlocked: (goalId: string, text: string) => void
  now?: () => number
  every?: (run: () => void, ms: number) => () => void
}

type StrandedMail = {
  messageId: string
  firstSeenAt: number
  inputSnapshot: number | undefined
  nudges: number
  lastNudgeAt?: number
  blocked?: boolean
}

function defaultEvery(run: () => void, ms: number): () => void {
  const timer = setInterval(run, ms)
  return () => clearInterval(timer)
}

export function startAutonomousGoalMailWatchdog(ports: AutonomousGoalMailWatchdogPorts): {
  check: () => Promise<void>
  stop: () => void
} {
  const now = ports.now ?? Date.now
  const stranded = new Map<string, StrandedMail>()
  let checking = false

  async function checkGoal(goal: AutonomousGoal): Promise<void> {
    const messageId = ports.oldestUnreadRunMessageId(goal.runId)
    const terminal = ports.resolveTerminalHandle(goal.paneKey)
    if (!messageId || !terminal) {
      stranded.delete(goal.id)
      return
    }
    const inputAt = ports.readLastInputAt(terminal)
    let state = stranded.get(goal.id)
    // Why: new mail, or the user typing into the pane, restarts the grace period.
    if (!state || state.messageId !== messageId || state.inputSnapshot !== inputAt) {
      state = { messageId, firstSeenAt: now(), inputSnapshot: inputAt, nudges: 0 }
      stranded.set(goal.id, state)
      return
    }
    if (now() - state.firstSeenAt < AUTONOMOUS_GOAL_MAIL_STRANDED_MS) {
      return
    }
    if (
      state.lastNudgeAt !== undefined &&
      now() - state.lastNudgeAt < AUTONOMOUS_GOAL_MAIL_RENUDGE_MS
    ) {
      return
    }
    if (state.nudges >= AUTONOMOUS_GOAL_MAIL_MAX_NUDGES) {
      if (!state.blocked) {
        state.blocked = true
        ports.markBlocked(
          goal.id,
          'Run mail stayed unread after repeated reminders; the coordinator is not handling it.'
        )
      }
      return
    }
    if ((await ports.readAgentStatus(terminal)) !== 'idle') {
      return
    }
    if (await ports.sendNudge(terminal, AUTONOMOUS_COORDINATOR_MAIL_NUDGE)) {
      state.nudges += 1
      state.lastNudgeAt = now()
    }
  }

  async function check(): Promise<void> {
    if (checking) {
      return
    }
    checking = true
    try {
      const open = new Set<string>()
      for (const goal of ports.listGoals()) {
        // Why: a usage-limited goal is paused on purpose; waking it spends the quota it saves.
        if (goal.status !== 'active' && goal.status !== 'blocked') {
          continue
        }
        open.add(goal.id)
        try {
          await checkGoal(goal)
        } catch (error) {
          console.warn('[autonomous-goals] mail watchdog check failed', error)
        }
      }
      for (const goalId of stranded.keys()) {
        if (!open.has(goalId)) {
          stranded.delete(goalId)
        }
      }
    } finally {
      checking = false
    }
  }

  const stop = (ports.every ?? defaultEvery)(() => void check(), AUTONOMOUS_GOAL_MAIL_CHECK_MS)
  return { check, stop }
}
