import { buildAutonomousCoordinatorLaunchPrompt } from '../../../shared/autonomous-coordinator-prompt'
import {
  AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT,
  AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS,
  clampAutonomousGoalMaxConcurrent,
  isAutonomousGoalAgent,
  type AutonomousGoalAgent
} from '../../../shared/autonomous-goal-types'
import type { TuiAgent } from '../../../shared/tui-agent'

export type AutonomousGoalDraft = {
  enabled: boolean
  objective: string
  workerAgent: AutonomousGoalAgent
  maxConcurrent: number
  removeWorktrees: boolean
  /** Shown only while removeWorktrees is on. */
  keepCoordinatorWorktree: boolean
}

export function createAutonomousGoalDraft(agent: TuiAgent | null): AutonomousGoalDraft {
  return {
    enabled: false,
    objective: '',
    workerAgent: isAutonomousGoalAgent(agent) ? agent : 'claude',
    maxConcurrent: AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT,
    removeWorktrees: true,
    keepCoordinatorWorktree: true
  }
}

/** True when the draft is on but cannot launch yet, so create must stay disabled. */
export function autonomousGoalDraftBlocksCreate(
  draft: AutonomousGoalDraft,
  agent: TuiAgent | null
): boolean {
  if (!draft.enabled) {
    return false
  }
  const objective = draft.objective.trim()
  return (
    !isAutonomousGoalAgent(agent) ||
    objective.length === 0 ||
    objective.length > AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS
  )
}

/** The coordinator's first prompt, or null when the draft does not apply to this launch. */
export function resolveAutonomousGoalLaunchPrompt(
  draft: AutonomousGoalDraft,
  agent: TuiAgent | null
): string | null {
  if (
    !draft.enabled ||
    !isAutonomousGoalAgent(agent) ||
    autonomousGoalDraftBlocksCreate(draft, agent)
  ) {
    return null
  }
  return buildAutonomousCoordinatorLaunchPrompt({
    objective: draft.objective,
    agent,
    workerAgent: draft.workerAgent,
    maxConcurrent: clampAutonomousGoalMaxConcurrent(draft.maxConcurrent),
    removeWorktrees: draft.removeWorktrees,
    keepCoordinatorWorktree: draft.keepCoordinatorWorktree
  })
}
