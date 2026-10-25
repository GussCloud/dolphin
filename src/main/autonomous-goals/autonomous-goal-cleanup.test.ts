import { describe, expect, it, vi } from 'vitest'
import type { AutonomousGoal, AutonomousGoalCleanup } from '../../shared/autonomous-goal-types'
import {
  AUTONOMOUS_GOAL_COORDINATOR_REMOVAL_DELAY_MS,
  AUTONOMOUS_GOAL_MERGE_CHECK_MS,
  startAutonomousGoalCleanup,
  type AutonomousGoalWorker,
  type AutonomousGoalWorktreeRemoval
} from './autonomous-goal-cleanup'

const baseGoal: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Ship',
  agent: 'claude',
  workerAgent: 'claude',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'pane-1',
  worktreeId: 'wt-coord',
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 0,
  updatedAt: 0
}

function harness(workers: AutonomousGoalWorker[]) {
  let clock = 0
  let goal: AutonomousGoal = { ...baseGoal }
  const listeners = new Set<(goal: AutonomousGoal) => void>()
  const merged = new Set<string>()
  const removalResults = new Map<string, AutonomousGoalWorktreeRemoval>()
  const scheduled: (() => void)[] = []
  const scheduledDelays: number[] = []
  const releaseWorker = vi.fn(async () => {})
  const removeWorktree = vi.fn(
    async (worktreeId: string) => removalResults.get(worktreeId) ?? { removed: true as const }
  )
  const isWorktreeReviewMerged = vi.fn(async (worktreeId: string) => merged.has(worktreeId))
  const setGoal = (patch: Partial<AutonomousGoal>) => {
    goal = { ...goal, ...patch }
    for (const listener of listeners) {
      listener(goal)
    }
  }
  const cleanup = startAutonomousGoalCleanup({
    listGoals: () => [goal],
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    listWorkers: () => workers,
    releaseWorker,
    isWorktreeReviewMerged,
    removeWorktree,
    recordCleanup: (_goalId, record: AutonomousGoalCleanup) => setGoal({ cleanup: record }),
    now: () => clock,
    every: () => () => {},
    schedule: (run, ms) => {
      scheduled.push(run)
      scheduledDelays.push(ms)
    }
  })
  return {
    cleanup,
    releaseWorker,
    removeWorktree,
    isWorktreeReviewMerged,
    merged,
    removalResults,
    scheduled,
    scheduledDelays,
    setGoal,
    goal: () => goal,
    advance: (ms: number) => {
      clock += ms
    }
  }
}

const settled = (dispatchId: string, worktreeId: string): AutonomousGoalWorker => ({
  dispatchId,
  workerState: 'succeeded',
  worktreeId,
  terminalState: 'reclaimable'
})

describe('autonomous goal cleanup while the goal runs', () => {
  it('frees a settled worker terminal at once but keeps its worktree until the PR merged', async () => {
    const h = harness([settled('d1', 'wt-1')])
    await h.cleanup.check()
    expect(h.releaseWorker).toHaveBeenCalledExactlyOnceWith('d1')
    expect(h.removeWorktree).not.toHaveBeenCalled()

    h.merged.add('wt-1')
    await h.cleanup.check()
    expect(h.removeWorktree).not.toHaveBeenCalled()
    h.advance(AUTONOMOUS_GOAL_MERGE_CHECK_MS)
    await h.cleanup.check()
    expect(h.removeWorktree).toHaveBeenCalledExactlyOnceWith('wt-1')
    expect(h.goal().cleanup?.removedWorktreeIds).toEqual(['wt-1'])
  })

  it('never touches a running worker or the coordinator worktree', async () => {
    const h = harness([
      { dispatchId: 'd1', workerState: 'ready', worktreeId: 'wt-1', terminalState: 'active' },
      settled('d2', 'wt-coord')
    ])
    h.merged.add('wt-1')
    h.merged.add('wt-coord')
    await h.cleanup.check()
    expect(h.releaseWorker).toHaveBeenCalledExactlyOnceWith('d2')
    expect(h.removeWorktree).not.toHaveBeenCalled()
  })
})

describe('autonomous goal closing sweep', () => {
  it('removes every settled worker worktree, failed ones too, then the coordinator after a delay', async () => {
    const h = harness([
      settled('d1', 'wt-1'),
      { dispatchId: 'd2', workerState: 'failed', worktreeId: 'wt-2', terminalState: 'reclaimable' }
    ])
    h.setGoal({ status: 'complete', keepCoordinatorWorktree: false })
    await vi.waitFor(() => expect(h.removeWorktree).toHaveBeenCalledTimes(2))
    expect(h.removeWorktree).not.toHaveBeenCalledWith('wt-coord')
    expect(h.scheduledDelays).toEqual([AUTONOMOUS_GOAL_COORDINATOR_REMOVAL_DELAY_MS])

    h.scheduled[0]!()
    await vi.waitFor(() => expect(h.goal().cleanup?.finishedAt).toBeDefined())
    expect(h.removeWorktree).toHaveBeenLastCalledWith('wt-coord')
    expect(h.goal().cleanup?.removedWorktreeIds).toEqual(['wt-1', 'wt-2', 'wt-coord'])
  })

  it('keeps the coordinator worktree when the goal was stopped', async () => {
    const h = harness([settled('d1', 'wt-1')])
    h.setGoal({ status: 'stopped' })
    await vi.waitFor(() => expect(h.goal().cleanup?.finishedAt).toBeDefined())
    expect(h.removeWorktree).toHaveBeenCalledExactlyOnceWith('wt-1')
    expect(h.scheduled).toHaveLength(0)
  })

  it('records a worktree it could not remove instead of forcing it', async () => {
    const h = harness([settled('d1', 'wt-1')])
    h.removalResults.set('wt-1', { removed: false, reason: 'worktree has uncommitted changes' })
    h.setGoal({ status: 'stopped' })
    await vi.waitFor(() => expect(h.goal().cleanup?.finishedAt).toBeDefined())
    expect(h.goal().cleanup).toMatchObject({
      removedWorktreeIds: [],
      retained: [{ worktreeId: 'wt-1', reason: 'worktree has uncommitted changes' }]
    })
  })

  it('runs the closing sweep once, even across repeated store updates and checks', async () => {
    const h = harness([settled('d1', 'wt-1')])
    h.setGoal({ status: 'complete', keepCoordinatorWorktree: false })
    await vi.waitFor(() => expect(h.scheduled).toHaveLength(1))
    await h.cleanup.check()
    h.scheduled[0]!()
    await vi.waitFor(() => expect(h.goal().cleanup?.finishedAt).toBeDefined())
    await h.cleanup.check()
    expect(h.scheduled).toHaveLength(1)
    expect(h.removeWorktree.mock.calls.map(([id]) => id)).toEqual(['wt-1', 'wt-coord'])
  })
})

describe('autonomous goal cleanup choices from the composer', () => {
  it('keeps the coordinator worktree by default when the goal completes', async () => {
    const h = harness([settled('d1', 'wt-1')])
    h.setGoal({ status: 'complete' })
    await vi.waitFor(() => expect(h.goal().cleanup?.finishedAt).toBeDefined())
    expect(h.removeWorktree).toHaveBeenCalledExactlyOnceWith('wt-1')
    expect(h.scheduled).toHaveLength(0)
  })

  it('leaves every terminal and worktree alone when removal is off', async () => {
    const h = harness([settled('d1', 'wt-1')])
    h.setGoal({ removeWorktrees: false, keepCoordinatorWorktree: false })
    h.merged.add('wt-1')
    await h.cleanup.check()
    h.setGoal({ status: 'complete' })
    await h.cleanup.check()
    expect(h.releaseWorker).not.toHaveBeenCalled()
    expect(h.removeWorktree).not.toHaveBeenCalled()
    expect(h.scheduled).toHaveLength(0)
    expect(h.goal().cleanup).toBeUndefined()
  })
})
