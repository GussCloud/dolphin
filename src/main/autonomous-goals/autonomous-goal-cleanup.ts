// Tears down what an autonomous goal's workers leave behind, so a finished goal holds no terminals,
// agent processes or worktrees. Settled workers lose their terminal at once; a worker's worktree
// goes once its PR merged (the worker drives CI until then), and the closing sweep takes the rest.
import {
  autonomousGoalRemovesCoordinatorWorktree,
  autonomousGoalRemovesWorktrees,
  isAutonomousGoalOpen,
  type AutonomousGoal,
  type AutonomousGoalCleanup
} from '../../shared/autonomous-goal-types'

export const AUTONOMOUS_GOAL_CLEANUP_CHECK_MS = 60_000
/** Per worktree; a hosted-review lookup costs provider API quota. */
export const AUTONOMOUS_GOAL_MERGE_CHECK_MS = 2 * 60_000
/** Lets the coordinator finish its closing reply before its own pane is torn down. */
export const AUTONOMOUS_GOAL_COORDINATOR_REMOVAL_DELAY_MS = 30_000

export type AutonomousGoalWorker = {
  dispatchId: string
  /** succeeded | failed | stopped | abandoned once settled; anything else is still running. */
  workerState: string
  worktreeId: string | null
  /** `reclaimable` while the settled worker still holds its terminal. */
  terminalState: string | null
}

export type AutonomousGoalWorktreeRemoval = { removed: true } | { removed: false; reason: string }

export type AutonomousGoalCleanupPorts = {
  listGoals: () => AutonomousGoal[]
  subscribe: (listener: (goal: AutonomousGoal) => void) => () => void
  listWorkers: (runId: string) => AutonomousGoalWorker[]
  releaseWorker: (dispatchId: string) => Promise<void>
  /** True only when the worktree's branch has a merged PR/MR on its hosting provider. */
  isWorktreeReviewMerged: (worktreeId: string) => Promise<boolean>
  /** Never forced: uncommitted changes or an unmerged branch keep the worktree. */
  removeWorktree: (worktreeId: string) => Promise<AutonomousGoalWorktreeRemoval>
  recordCleanup: (goalId: string, cleanup: AutonomousGoalCleanup) => void
  now?: () => number
  every?: (run: () => void, ms: number) => () => void
  schedule?: (run: () => void, ms: number) => void
}

const SETTLED_WORKER_STATES = new Set(['succeeded', 'failed', 'stopped', 'abandoned'])

function emptyCleanup(goal: AutonomousGoal): AutonomousGoalCleanup {
  return goal.cleanup ?? { removedWorktreeIds: [], retained: [] }
}

export function startAutonomousGoalCleanup(ports: AutonomousGoalCleanupPorts): {
  check: () => Promise<void>
  sweep: (goalId: string) => Promise<void>
  stop: () => void
} {
  const now = ports.now ?? Date.now
  const lastMergeCheckAt = new Map<string, number>()
  const sweeping = new Set<string>()
  const coordinatorRemovalScheduled = new Set<string>()
  let checking = false

  const currentGoal = (goalId: string): AutonomousGoal | undefined =>
    ports.listGoals().find((goal) => goal.id === goalId)

  function record(goalId: string, change: (cleanup: AutonomousGoalCleanup) => void): void {
    const goal = currentGoal(goalId)
    if (!goal) {
      return
    }
    const cleanup = emptyCleanup(goal)
    const next = {
      ...cleanup,
      removedWorktreeIds: [...cleanup.removedWorktreeIds],
      retained: [...cleanup.retained]
    }
    change(next)
    ports.recordCleanup(goalId, next)
  }

  async function remove(goal: AutonomousGoal, worktreeId: string): Promise<void> {
    if (emptyCleanup(currentGoal(goal.id) ?? goal).removedWorktreeIds.includes(worktreeId)) {
      return
    }
    const result = await ports
      .removeWorktree(worktreeId)
      .catch((error: unknown): AutonomousGoalWorktreeRemoval => ({
        removed: false,
        reason: error instanceof Error ? error.message : String(error)
      }))
    record(goal.id, (cleanup) => {
      cleanup.retained = cleanup.retained.filter((entry) => entry.worktreeId !== worktreeId)
      if (result.removed) {
        cleanup.removedWorktreeIds.push(worktreeId)
      } else {
        cleanup.retained.push({ worktreeId, reason: result.reason })
      }
    })
  }

  async function releaseSettled(worker: AutonomousGoalWorker): Promise<void> {
    if (SETTLED_WORKER_STATES.has(worker.workerState) && worker.terminalState === 'reclaimable') {
      await ports.releaseWorker(worker.dispatchId).catch((error: unknown) => {
        console.warn('[autonomous-goals] worker release failed', worker.dispatchId, error)
      })
    }
  }

  /** While the goal runs: free terminals at settlement, worktrees once their PR merged. */
  async function tendOpenGoal(goal: AutonomousGoal): Promise<void> {
    // Why: a goal started with "keep worktrees" leaves every terminal and worktree to the user.
    if (!autonomousGoalRemovesWorktrees(goal)) {
      return
    }
    for (const worker of ports.listWorkers(goal.runId)) {
      await releaseSettled(worker)
      const { worktreeId } = worker
      if (
        worker.workerState !== 'succeeded' ||
        !worktreeId ||
        worktreeId === goal.worktreeId ||
        emptyCleanup(goal).removedWorktreeIds.includes(worktreeId)
      ) {
        continue
      }
      const checkedAt = lastMergeCheckAt.get(worktreeId)
      if (checkedAt !== undefined && now() - checkedAt < AUTONOMOUS_GOAL_MERGE_CHECK_MS) {
        continue
      }
      lastMergeCheckAt.set(worktreeId, now())
      if (await ports.isWorktreeReviewMerged(worktreeId).catch(() => false)) {
        await remove(goal, worktreeId)
      }
    }
  }

  /** Once the goal closes: every settled worker's worktree, and the coordinator's if the goal asked. */
  async function sweep(goalId: string): Promise<void> {
    const goal = currentGoal(goalId)
    if (
      !goal ||
      isAutonomousGoalOpen(goal) ||
      goal.cleanup?.finishedAt !== undefined ||
      !autonomousGoalRemovesWorktrees(goal) ||
      sweeping.has(goalId) ||
      coordinatorRemovalScheduled.has(goalId)
    ) {
      return
    }
    sweeping.add(goalId)
    try {
      for (const worker of ports.listWorkers(goal.runId)) {
        await releaseSettled(worker)
        const { worktreeId } = worker
        if (!worktreeId || worktreeId === goal.worktreeId) {
          continue
        }
        if (SETTLED_WORKER_STATES.has(worker.workerState)) {
          await remove(goal, worktreeId)
        } else {
          record(goal.id, (cleanup) => {
            cleanup.retained = cleanup.retained.filter((entry) => entry.worktreeId !== worktreeId)
            cleanup.retained.push({ worktreeId, reason: 'worker still running' })
          })
        }
      }
      const coordinatorWorktreeId =
        goal.status === 'complete' && autonomousGoalRemovesCoordinatorWorktree(goal)
          ? goal.worktreeId
          : null
      if (!coordinatorWorktreeId) {
        record(goal.id, (cleanup) => {
          cleanup.finishedAt = now()
        })
        return
      }
      // Why: removing the coordinator's worktree stops its own pane, which is still replying.
      coordinatorRemovalScheduled.add(goalId)
      ;(ports.schedule ?? setTimeout)(() => {
        void remove(goal, coordinatorWorktreeId)
          .catch((error: unknown) => {
            console.warn('[autonomous-goals] coordinator worktree removal failed', error)
          })
          .finally(() => {
            record(goal.id, (cleanup) => {
              cleanup.finishedAt = now()
            })
            coordinatorRemovalScheduled.delete(goalId)
          })
      }, AUTONOMOUS_GOAL_COORDINATOR_REMOVAL_DELAY_MS)
    } finally {
      sweeping.delete(goalId)
    }
  }

  async function check(): Promise<void> {
    if (checking) {
      return
    }
    checking = true
    try {
      for (const goal of ports.listGoals()) {
        try {
          if (isAutonomousGoalOpen(goal)) {
            await tendOpenGoal(goal)
          } else if (goal.cleanup?.finishedAt === undefined) {
            // Why: a sweep interrupted by an app restart resumes from stored state.
            await sweep(goal.id)
          }
        } catch (error) {
          console.warn('[autonomous-goals] cleanup check failed', goal.id, error)
        }
      }
    } finally {
      checking = false
    }
  }

  const unsubscribe = ports.subscribe((goal) => {
    if (!isAutonomousGoalOpen(goal) && goal.cleanup?.finishedAt === undefined) {
      void sweep(goal.id)
    }
  })
  const stopTimer = (ports.every ?? defaultEvery)(
    () => void check(),
    AUTONOMOUS_GOAL_CLEANUP_CHECK_MS
  )
  return {
    check,
    sweep,
    stop: () => {
      unsubscribe()
      stopTimer()
    }
  }
}

function defaultEvery(run: () => void, ms: number): () => void {
  const timer = setInterval(run, ms)
  return () => clearInterval(timer)
}
