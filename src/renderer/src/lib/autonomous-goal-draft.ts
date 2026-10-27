import { buildAutonomousCoordinatorLaunchPrompt } from '../../../shared/autonomous-coordinator-prompt'
import {
  AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT,
  AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS,
  AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS,
  clampAutonomousGoalMaxConcurrent,
  isAutonomousGoalAgent,
  type AutonomousGoalAgent
} from '../../../shared/autonomous-goal-types'
import type { TuiAgent } from '../../../shared/tui-agent'
import {
  DEFAULT_ORCHESTRATION_AGENT,
  DEFAULT_ORCHESTRATION_AGENT_ID,
  type OrchestrationAgentProfile
} from '../../../shared/orchestration-agent-profiles'

/** The composer's steps: basics, mode, orchestration agent, extra instructions. */
export type ComposerWizardStep = 1 | 2 | 3 | 4
export const COMPOSER_WIZARD_LAST_STEP: ComposerWizardStep = 4

export type AutonomousGoalDraft = {
  /** True in the Orchestration mode. */
  enabled: boolean
  step: ComposerWizardStep
  /** The orchestration agent picked on step 3. */
  agentId: string
  instructions: string
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
    step: 1,
    agentId: DEFAULT_ORCHESTRATION_AGENT_ID,
    instructions: '',
    objective: '',
    workerAgent: isAutonomousGoalAgent(agent) ? agent : 'claude',
    maxConcurrent: AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT,
    removeWorktrees: true,
    keepCoordinatorWorktree: true
  }
}

/** Presets step 3 takes from a picked orchestration agent. */
export function applyOrchestrationAgentToDraft(
  draft: AutonomousGoalDraft,
  orchestrationAgent: OrchestrationAgentProfile
): AutonomousGoalDraft {
  return {
    ...draft,
    agentId: orchestrationAgent.id,
    workerAgent: orchestrationAgent.workerAgent,
    maxConcurrent: orchestrationAgent.maxConcurrent
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
    // Why: an orchestration starts only from the last step, never by a shortcut on an earlier one.
    draft.step !== COMPOSER_WIZARD_LAST_STEP ||
    !isAutonomousGoalAgent(agent) ||
    objective.length === 0 ||
    objective.length > AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS ||
    draft.instructions.trim().length > AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS
  )
}

/** The coordinator's first prompt, or null when the draft does not apply to this launch. */
export function resolveAutonomousGoalLaunchPrompt(
  draft: AutonomousGoalDraft,
  agent: TuiAgent | null,
  orchestrationAgent: OrchestrationAgentProfile = DEFAULT_ORCHESTRATION_AGENT
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
    keepCoordinatorWorktree: draft.keepCoordinatorWorktree,
    // Why: Dolphin's own agent adds nothing, so a default launch stays valid on older hosts.
    ...(orchestrationAgent.id === DEFAULT_ORCHESTRATION_AGENT_ID
      ? {}
      : { agentName: orchestrationAgent.name, strategy: orchestrationAgent.strategy }),
    instructions: draft.instructions
  })
}
