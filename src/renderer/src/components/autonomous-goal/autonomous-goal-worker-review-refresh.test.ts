import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))

import { newlySettledWorkerWorktreeIds } from './autonomous-goal-worker-review-refresh'
import type { AutonomousGoalListEntry } from '../../../../shared/autonomous-goal-types'

function goals(workers: [string, string][]): AutonomousGoalListEntry[] {
  return [
    {
      id: 'goal_1',
      objective: 'x',
      agent: 'claude',
      workerAgent: 'claude',
      maxConcurrent: 2,
      status: 'active',
      paneKey: 'p',
      worktreeId: 'wt-coord',
      runId: 'run_1',
      notes: [],
      rotations: 0,
      createdAt: 0,
      updatedAt: 0,
      progress: {
        tasksTotal: workers.length,
        tasksCompleted: 0,
        workers: workers.map(([worktreeId, taskStatus], index) => ({
          worktreeId,
          taskOrdinal: index + 1,
          taskStatus
        }))
      }
    }
  ]
}

describe('newlySettledWorkerWorktreeIds', () => {
  it('reports only workers seen running that then completed or failed', () => {
    const before = goals([
      ['wt-a', 'dispatched'],
      ['wt-b', 'dispatched'],
      ['wt-c', 'completed']
    ])
    const after = goals([
      ['wt-a', 'completed'],
      ['wt-b', 'failed'],
      ['wt-c', 'completed'],
      ['wt-d', 'completed']
    ])
    expect(newlySettledWorkerWorktreeIds(before, after)).toEqual(['wt-a', 'wt-b'])
  })

  it('reports nothing on the first load', () => {
    expect(newlySettledWorkerWorktreeIds([], goals([['wt-a', 'completed']]))).toEqual([])
  })
})
