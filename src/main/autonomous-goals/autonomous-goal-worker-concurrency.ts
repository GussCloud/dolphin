import type Database from '../sqlite/sync-database'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import type { AutonomousGoalStore } from './autonomous-goal-store'

/** Workers of a Run still on their Task: Dispatch open and worker not settled. */
export function countRunningWorkers(db: Database.Database, runId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM dispatch_contexts dc
       JOIN worker_dispatches wd ON wd.dispatch_id = dc.id
       WHERE dc.run_id = ? AND dc.status IN ('pending', 'dispatched')
         AND wd.state NOT IN ('failed', 'succeeded', 'stopped', 'abandoned')`
    )
    .get(runId)
  return Number(row?.n ?? 0)
}

/** Called before a goal's coordinator starts a worker; the goal's maxConcurrent is a hard cap. */
export function assertAutonomousGoalWorkerSlot(
  getStore: () => AutonomousGoalStore,
  db: Database.Database,
  runId: string
): void {
  const running = countRunningWorkers(db, runId)
  // Why: maxConcurrent is at least 1, so the first worker never needs the goal file read.
  if (running === 0) {
    return
  }
  const goal = getStore().findOpenByRun(runId)
  if (!goal || running < goal.maxConcurrent) {
    return
  }
  throw new OrchestrationError(
    'goal_worker_limit',
    `This goal already runs ${running} of its ${goal.maxConcurrent} workers. Start this Task after a worker_done arrives; end your turn now.`,
    { effectsApplied: false, running, maxConcurrent: goal.maxConcurrent }
  )
}
