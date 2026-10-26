import type { AutonomousGoal } from '../../../../shared/autonomous-goal-types'
import {
  refreshAutonomousGoalIndex,
  stopAutonomousGoal,
  useAutonomousGoalIndexPolling,
  useCoordinatedAutonomousGoal
} from './autonomous-goal-index'

/** The newest open goal coordinated from this worktree, from the shared goal poll. */
export function useWorktreeAutonomousGoal(worktreeId: string | null): {
  goal: AutonomousGoal | null
  refresh: () => Promise<void>
  stop: (goalId: string) => Promise<void>
} {
  useAutonomousGoalIndexPolling()
  return {
    goal: useCoordinatedAutonomousGoal(worktreeId),
    refresh: refreshAutonomousGoalIndex,
    stop: stopAutonomousGoal
  }
}
