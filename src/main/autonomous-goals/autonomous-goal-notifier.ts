// Tells the user when an autonomous goal needs them: done, blocked on a decision, or paused on usage.
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import type { NotificationDispatchRequest } from '../../shared/notification-settings-types'

export type AutonomousGoalNotifierPorts = {
  listGoals: () => AutonomousGoal[]
  subscribe: (listener: (goal: AutonomousGoal) => void) => () => void
  notify: (request: NotificationDispatchRequest) => void
}

type NotifiedEvent = NonNullable<NotificationDispatchRequest['goalEvent']>

function eventFor(goal: AutonomousGoal): NotifiedEvent | null {
  return goal.status === 'complete' || goal.status === 'blocked' || goal.status === 'usageLimited'
    ? goal.status
    : null
}

function detailFor(goal: AutonomousGoal, event: NotifiedEvent): string | undefined {
  if (event === 'complete') {
    return goal.summary
  }
  if (event === 'blocked') {
    return goal.notes.findLast((note) => note.kind === 'blocker')?.text
  }
  return undefined
}

export function startAutonomousGoalNotifier(ports: AutonomousGoalNotifierPorts): () => void {
  // Why: seeded from the stored state so a restart does not re-announce old outcomes.
  const lastStatus = new Map(ports.listGoals().map((goal) => [goal.id, goal.status]))
  return ports.subscribe((goal) => {
    const previous = lastStatus.get(goal.id)
    lastStatus.set(goal.id, goal.status)
    const event = eventFor(goal)
    if (!event || previous === goal.status) {
      return
    }
    const detail = detailFor(goal, event)
    ports.notify({
      source: 'autonomous-goal',
      goalEvent: event,
      ...(detail ? { goalDetail: detail } : {}),
      ...(goal.worktreeId ? { worktreeId: goal.worktreeId } : {}),
      paneKey: goal.paneKey,
      agentType: goal.agent
    })
  })
}
