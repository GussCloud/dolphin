import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import {
  AUTONOMOUS_GOAL_USAGE_RESUME_GRACE_MS,
  AUTONOMOUS_GOAL_USAGE_RESUME_NOTICE,
  startAutonomousGoalUsageResume
} from './autonomous-goal-usage-resume'

const BASE: AutonomousGoal = {
  id: 'goal_1',
  objective: 'x',
  agent: 'claude',
  workerAgent: 'codex',
  maxConcurrent: 2,
  status: 'usageLimited',
  paneKey: 'pane-1',
  worktreeId: null,
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 0,
  updatedAt: 0
}

describe('usage-window resume', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000 }))
  afterEach(() => vi.useRealTimers())

  function harness(initial: AutonomousGoal) {
    let goal = initial
    let listener: (goal: AutonomousGoal) => void = () => {}
    const sent: string[] = []
    const dispose = startAutonomousGoalUsageResume({
      listGoals: () => [goal],
      subscribe: (next) => {
        listener = next
        return () => {}
      },
      markActive: () => {
        goal = { ...goal, status: 'active', usageResumeAt: undefined }
      },
      resolveTerminalHandle: () => 'term-1',
      sendPrompt: async (_terminal, text) => {
        sent.push(text)
        return 'accepted'
      }
    })
    return {
      sent,
      get goal() {
        return goal
      },
      update(next: AutonomousGoal) {
        goal = next
        listener(next)
      },
      dispose
    }
  }

  it('re-arms from the stored reset time at start and wakes the coordinator after it', async () => {
    const h = harness({ ...BASE, usageResumeAt: 61_000 })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.sent).toEqual([])
    await vi.advanceTimersByTimeAsync(AUTONOMOUS_GOAL_USAGE_RESUME_GRACE_MS)
    expect(h.goal.status).toBe('active')
    expect(h.sent).toEqual([AUTONOMOUS_GOAL_USAGE_RESUME_NOTICE])
  })

  it('drops the timer when the goal leaves the usage-limited state first', async () => {
    const h = harness({ ...BASE, usageResumeAt: 5_000 })
    h.update({ ...BASE, status: 'active', usageResumeAt: undefined })
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(h.sent).toEqual([])
  })
})
