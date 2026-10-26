import type {
  AutonomousGoalProgress,
  AutonomousGoalWorkerProgress
} from '../../shared/autonomous-goal-types'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

type ProgressDb = Pick<OrchestrationDb, 'listTasks' | 'listWorkerTerminalResources'>

/** Tasks done/total and each worker worktree's Task, read from local DB rows only. */
export function buildAutonomousGoalProgress(db: ProgressDb, runId: string): AutonomousGoalProgress {
  const tasks = db.listTasks({ runId })
  const ordinalByTaskId = new Map(tasks.map((task, index) => [task.id, index + 1]))
  const statusByTaskId = new Map(tasks.map((task) => [task.id, task.status]))
  const workers: AutonomousGoalWorkerProgress[] = []
  const seenWorktrees = new Set<string>()
  // Rows come newest first, so a retried Task's worktree keeps its latest attempt.
  for (const row of db.listWorkerTerminalResources({ runId })) {
    const ordinal = ordinalByTaskId.get(row.taskId)
    if (!row.worktreeId || ordinal === undefined || seenWorktrees.has(row.worktreeId)) {
      continue
    }
    seenWorktrees.add(row.worktreeId)
    workers.push({
      worktreeId: row.worktreeId,
      taskOrdinal: ordinal,
      taskStatus: statusByTaskId.get(row.taskId) ?? 'pending'
    })
  }
  return {
    tasksTotal: tasks.length,
    tasksCompleted: tasks.filter((task) => task.status === 'completed').length,
    workers
  }
}
