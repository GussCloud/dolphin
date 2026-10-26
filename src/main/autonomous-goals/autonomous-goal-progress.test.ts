import { describe, expect, it } from 'vitest'
import { buildAutonomousGoalProgress } from './autonomous-goal-progress'
import type { TaskStatus } from '../runtime/orchestration/types'

type Db = Parameters<typeof buildAutonomousGoalProgress>[0]

function fakeDb(
  tasks: { id: string; status: TaskStatus }[],
  workers: { taskId: string; worktreeId: string | null }[]
): Db {
  return { listTasks: () => tasks, listWorkerTerminalResources: () => workers }
}

describe('buildAutonomousGoalProgress', () => {
  it('counts completed Tasks and numbers each worker by its Task order', () => {
    const progress = buildAutonomousGoalProgress(
      fakeDb(
        [
          { id: 'task_a', status: 'completed' },
          { id: 'task_b', status: 'dispatched' },
          { id: 'task_c', status: 'pending' }
        ],
        [
          { taskId: 'task_b', worktreeId: 'wt-b' },
          { taskId: 'task_a', worktreeId: 'wt-a' }
        ]
      ),
      'run_1'
    )
    expect(progress).toEqual({
      tasksTotal: 3,
      tasksCompleted: 1,
      workers: [
        { worktreeId: 'wt-b', taskOrdinal: 2, taskStatus: 'dispatched' },
        { worktreeId: 'wt-a', taskOrdinal: 1, taskStatus: 'completed' }
      ]
    })
  })

  it('keeps the newest attempt per worktree and skips workers with no worktree or Task', () => {
    const progress = buildAutonomousGoalProgress(
      fakeDb(
        [
          { id: 'task_a', status: 'failed' },
          { id: 'task_b', status: 'dispatched' }
        ],
        [
          { taskId: 'task_b', worktreeId: 'wt-shared' },
          { taskId: 'task_a', worktreeId: 'wt-shared' },
          { taskId: 'task_a', worktreeId: null },
          { taskId: 'task_other_run', worktreeId: 'wt-x' }
        ]
      ),
      'run_1'
    )
    expect(progress.workers).toEqual([
      { worktreeId: 'wt-shared', taskOrdinal: 2, taskStatus: 'dispatched' }
    ])
  })
})
