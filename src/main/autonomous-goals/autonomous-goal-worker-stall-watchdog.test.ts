import { describe, expect, it, vi } from 'vitest'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import {
  AUTONOMOUS_GOAL_WORKER_IDLE_STALL_MS,
  AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS,
  startAutonomousGoalWorkerStallWatchdog,
  type StallWatchdogAgent,
  type StallWatchdogWorker
} from './autonomous-goal-worker-stall-watchdog'

const MINUTE = 60_000

const GOAL: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Ship',
  agent: 'claude',
  workerAgent: 'claude',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'coordinator',
  worktreeId: null,
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 1,
  updatedAt: 1
}

function setup(initialAgent: StallWatchdogAgent) {
  let now = 1_000_000
  let agent: StallWatchdogAgent | null = initialAgent
  let reportId: string | null = null
  let goal = GOAL
  const worker: StallWatchdogWorker = {
    dispatchId: 'dispatch_1',
    taskId: 'task_1',
    taskOrdinal: 1,
    taskStatus: 'dispatched',
    paneKey: 'worker-pane',
    awaitingReply: false
  }
  const stopWorker = vi.fn(async () => {})
  const escalate = vi.fn()
  const markBlocked = vi.fn()
  const watchdog = startAutonomousGoalWorkerStallWatchdog({
    listGoals: () => [goal],
    listActiveWorkers: () => [worker],
    latestWorkerReportId: () => reportId,
    readWorkerAgent: () => agent,
    stopWorker,
    escalate,
    markBlocked,
    now: () => now,
    every: () => () => {}
  })
  return {
    worker,
    stopWorker,
    escalate,
    markBlocked,
    check: watchdog.check,
    /** Advance time; a live agent keeps posting hooks, so its row stays fresh. */
    advance: (ms: number) => {
      now += ms
      if (agent) {
        agent = { ...agent, observedAt: now }
      }
    },
    now: () => now,
    setAgent: (next: StallWatchdogAgent | null) => {
      agent = next
    },
    setReport: (id: string) => {
      reportId = id
    },
    setGoal: (next: AutonomousGoal) => {
      goal = next
    }
  }
}

const working = (at: number): StallWatchdogAgent => ({
  state: 'working',
  stateStartedAt: at,
  observedAt: at
})

describe('startAutonomousGoalWorkerStallWatchdog', () => {
  it('stops and escalates a live worker after two hours with no progress signal', async () => {
    const harness = setup(working(1_000_000))
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS - MINUTE)
    await harness.check()
    expect(harness.stopWorker).not.toHaveBeenCalled()

    harness.advance(MINUTE)
    await harness.check()
    expect(harness.stopWorker).toHaveBeenCalledWith('dispatch_1')
    expect(harness.escalate).toHaveBeenCalledWith(GOAL, harness.worker, 'no progress for 120 min')

    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS)
    await harness.check()
    expect(harness.stopWorker).toHaveBeenCalledTimes(1)
  })

  it('does not count heartbeats, but a real report or a state change restarts the clock', async () => {
    const harness = setup(working(1_000_000))
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS - MINUTE)
    harness.setReport('message_question')
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS - MINUTE)
    harness.setAgent(working(harness.now()))
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS - MINUTE)
    await harness.check()
    expect(harness.stopWorker).not.toHaveBeenCalled()
  })

  it('stops a worker idle for 30 minutes without reporting', async () => {
    const harness = setup({ state: 'done', stateStartedAt: 1_000_000, observedAt: 1_000_000 })
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_IDLE_STALL_MS)
    await harness.check()
    expect(harness.escalate).toHaveBeenCalledWith(
      GOAL,
      harness.worker,
      'idle for 30 min without reporting'
    )
  })

  it('blocks the goal for the user, without stopping, when a worker waits on input', async () => {
    const harness = setup({ state: 'waiting', stateStartedAt: 1_000_000, observedAt: 1_000_000 })
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_IDLE_STALL_MS)
    await harness.check()
    expect(harness.stopWorker).not.toHaveBeenCalled()
    expect(harness.markBlocked).toHaveBeenCalledWith(
      'goal_1',
      "Task 1's worker has waited for input for 30 min; answer it in its terminal."
    )
  })

  it('leaves a worker alone while it waits for a reply to its question', async () => {
    const harness = setup({ state: 'done', stateStartedAt: 1_000_000, observedAt: 1_000_000 })
    harness.worker.awaitingReply = true
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS)
    await harness.check()
    expect(harness.stopWorker).not.toHaveBeenCalled()
    expect(harness.markBlocked).not.toHaveBeenCalled()
  })

  it('never acts on a worker whose status is not fresh, such as an unreachable SSH host', async () => {
    const harness = setup(working(1_000_000))
    await harness.check()
    harness.setAgent(working(1_000_000))
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS)
    harness.setAgent(working(1_000_000))
    await harness.check()
    expect(harness.stopWorker).not.toHaveBeenCalled()
  })

  it('skips a usage-limited goal', async () => {
    const harness = setup(working(1_000_000))
    harness.setGoal({ ...GOAL, status: 'usageLimited' })
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS)
    await harness.check()
    expect(harness.stopWorker).not.toHaveBeenCalled()
  })

  it('blocks the goal instead of escalating when the same Task stalls a second time', async () => {
    const harness = setup(working(1_000_000))
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS)
    await harness.check()
    expect(harness.escalate).toHaveBeenCalledTimes(1)

    // The retry is a new dispatch of the same Task.
    harness.worker.dispatchId = 'dispatch_2'
    await harness.check()
    harness.advance(AUTONOMOUS_GOAL_WORKER_NO_PROGRESS_MS)
    await harness.check()
    expect(harness.stopWorker).toHaveBeenLastCalledWith('dispatch_2')
    expect(harness.escalate).toHaveBeenCalledTimes(1)
    expect(harness.markBlocked).toHaveBeenCalledWith(
      'goal_1',
      'Task 1 stalled twice (no progress for 120 min); Dolphin stopped its worker and will not retry it again.'
    )
  })
})
