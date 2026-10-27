// Catches a goal worker that is alive but not moving. Its heartbeat mail is self-reported and a
// looping agent keeps sending it, and worker-list's nextAction is `none` for any live worker, so
// nothing else noticed one that sat for hours. Reads only local state: no model call, no polling.
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import type { AgentStatusState } from '../../shared/agent-status-types'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../shared/agent-status-freshness'

export const AUTONOMOUS_GOAL_STALL_CHECK_MS = 60_000
/** Waiting on input, or idle without reporting, this long counts as stuck. */
export const AUTONOMOUS_GOAL_WORKER_IDLE_STALL_MS = 30 * 60_000
/** Working this long with no progress signal counts as stuck. */
export const AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS = 2 * 60 * 60_000

export type StallWatchdogWorker = {
  dispatchId: string
  taskId: string
  taskOrdinal: number
  taskStatus: string
  paneKey: string | null
  /** A question, approval or guidance still pending: the worker waits on someone else. */
  awaitingReply: boolean
}

export type StallWatchdogAgent = {
  state: AgentStatusState
  stateStartedAt: number
  observedAt: number
}

export type AutonomousGoalWorkerStallPorts = {
  listGoals: () => AutonomousGoal[]
  listActiveWorkers: (runId: string) => StallWatchdogWorker[]
  /** The newest non-heartbeat Run message this worker sent, or null. */
  latestWorkerReportId: (runId: string, dispatchId: string) => string | null
  readWorkerAgent: (paneKey: string) => StallWatchdogAgent | null
  stopWorker: (dispatchId: string) => Promise<void>
  /** Puts a high-priority escalation in the Run mailbox, which wakes the coordinator. */
  escalate: (goal: AutonomousGoal, worker: StallWatchdogWorker, reason: string) => void
  markBlocked: (goalId: string, text: string) => void
  now?: () => number
  every?: (run: () => void, ms: number) => () => void
}

type WorkerProgress = { fingerprint: string; lastProgressAt: number; handled?: boolean }

function defaultEvery(run: () => void, ms: number): () => void {
  const timer = setInterval(run, ms)
  return () => clearInterval(timer)
}

function minutes(ms: number): number {
  return Math.round(ms / 60_000)
}

export function startAutonomousGoalWorkerStallWatchdog(ports: AutonomousGoalWorkerStallPorts): {
  check: () => Promise<void>
  stop: () => void
} {
  const now = ports.now ?? Date.now
  const progressByDispatch = new Map<string, WorkerProgress>()
  const stallsByTask = new Map<string, number>()
  let checking = false

  async function stall(
    goal: AutonomousGoal,
    worker: StallWatchdogWorker,
    reason: string
  ): Promise<void> {
    const stalls = (stallsByTask.get(worker.taskId) ?? 0) + 1
    stallsByTask.set(worker.taskId, stalls)
    try {
      await ports.stopWorker(worker.dispatchId)
    } catch (error) {
      ports.markBlocked(
        goal.id,
        `Task ${worker.taskOrdinal}'s worker is stuck (${reason}) and Dolphin could not stop it: ${error instanceof Error ? error.message : String(error)}`
      )
      return
    }
    if (stalls >= 2) {
      ports.markBlocked(
        goal.id,
        `Task ${worker.taskOrdinal} stalled twice (${reason}); Dolphin stopped its worker and will not retry it again.`
      )
      return
    }
    ports.escalate(goal, worker, reason)
  }

  async function checkWorker(goal: AutonomousGoal, worker: StallWatchdogWorker): Promise<void> {
    const agent = worker.paneKey ? ports.readWorkerAgent(worker.paneKey) : null
    // Why: no fresh status row is `unverifiable`, never evidence of a stall.
    if (!agent || now() - agent.observedAt > AGENT_STATUS_STALE_AFTER_MS) {
      return
    }
    const fingerprint = [
      worker.taskStatus,
      ports.latestWorkerReportId(goal.runId, worker.dispatchId) ?? '',
      agent.state,
      agent.stateStartedAt,
      worker.awaitingReply
    ].join('|')
    const progress = progressByDispatch.get(worker.dispatchId)
    if (!progress || progress.fingerprint !== fingerprint) {
      progressByDispatch.set(worker.dispatchId, { fingerprint, lastProgressAt: now() })
      return
    }
    if (progress.handled || worker.awaitingReply) {
      return
    }
    const sinceProgress = now() - progress.lastProgressAt
    const inState = Math.min(sinceProgress, now() - agent.stateStartedAt)
    if (
      (agent.state === 'waiting' || agent.state === 'blocked') &&
      inState >= AUTONOMOUS_GOAL_WORKER_IDLE_STALL_MS
    ) {
      progress.handled = true
      // Why not stop it: a permission prompt needs a person, and a retry would ask again.
      ports.markBlocked(
        goal.id,
        `Task ${worker.taskOrdinal}'s worker has waited for input for ${minutes(inState)} min; answer it in its terminal.`
      )
      return
    }
    if (agent.state === 'done' && inState >= AUTONOMOUS_GOAL_WORKER_IDLE_STALL_MS) {
      progress.handled = true
      await stall(goal, worker, `idle for ${minutes(inState)} min without reporting`)
      return
    }
    if (sinceProgress >= AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS) {
      progress.handled = true
      await stall(goal, worker, `no progress for ${minutes(sinceProgress)} min`)
    }
  }

  async function check(): Promise<void> {
    if (checking) {
      return
    }
    checking = true
    try {
      const seen = new Set<string>()
      for (const goal of ports.listGoals()) {
        // Why: a usage-limited goal is paused on purpose; its workers may sit until the reset.
        if (goal.status !== 'active' && goal.status !== 'blocked') {
          continue
        }
        for (const worker of ports.listActiveWorkers(goal.runId)) {
          seen.add(worker.dispatchId)
          try {
            await checkWorker(goal, worker)
          } catch (error) {
            console.warn('[autonomous-goals] stall watchdog check failed', error)
          }
        }
      }
      for (const dispatchId of progressByDispatch.keys()) {
        if (!seen.has(dispatchId)) {
          progressByDispatch.delete(dispatchId)
        }
      }
    } finally {
      checking = false
    }
  }

  const stop = (ports.every ?? defaultEvery)(() => void check(), AUTONOMOUS_GOAL_STALL_CHECK_MS)
  return { check, stop }
}
