import { describe, expect, it } from 'vitest'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import type { NotificationDispatchRequest } from '../../shared/notification-settings-types'
import { startAutonomousGoalNotifier } from './autonomous-goal-notifier'

const GOAL: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Ship',
  agent: 'codex',
  workerAgent: 'codex',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'pane-1',
  worktreeId: 'wt-1',
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 0,
  updatedAt: 0
}

describe('autonomous goal notifier', () => {
  function harness(initial: AutonomousGoal[]) {
    let listener: (goal: AutonomousGoal) => void = () => {}
    const sent: NotificationDispatchRequest[] = []
    startAutonomousGoalNotifier({
      listGoals: () => initial,
      subscribe: (next) => {
        listener = next
        return () => {}
      },
      notify: (request) => sent.push(request)
    })
    return { sent, emit: (goal: AutonomousGoal) => listener(goal) }
  }

  it('announces each transition into a state that needs the user, once', () => {
    const h = harness([GOAL])
    const blocked: AutonomousGoal = {
      ...GOAL,
      status: 'blocked',
      notes: [{ kind: 'blocker', text: 'Pick a database', at: 1 }]
    }
    h.emit(blocked)
    h.emit({ ...blocked, updatedAt: 5 })
    h.emit({ ...GOAL, status: 'complete', summary: 'All PRs merged' })
    expect(h.sent).toEqual([
      expect.objectContaining({
        goalEvent: 'blocked',
        goalDetail: 'Pick a database',
        worktreeId: 'wt-1'
      }),
      expect.objectContaining({ goalEvent: 'complete', goalDetail: 'All PRs merged' })
    ])
  })

  it('does not re-announce stored outcomes after a restart or plain progress', () => {
    const h = harness([{ ...GOAL, status: 'complete' }])
    h.emit({ ...GOAL, status: 'complete', rotations: 1 })
    h.emit({ ...GOAL, id: 'goal_2', rotations: 3 })
    expect(h.sent).toEqual([])
  })
})
