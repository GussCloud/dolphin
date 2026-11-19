import {
  isAutonomousGoalAgent,
  type AutonomousGoalAgent
} from '../../../shared/autonomous-goal-types'
import { DESIGN_NAME_MAX_CHARS, DESIGN_REQUEST_MAX_CHARS } from '../../../shared/design-types'
import type { TuiAgent } from '../../../shared/tui-agent'

/** Which creation flow the composer runs; the Design flow replaces the mode picker. */
export type ComposerFlow = 'workspace' | 'design'

/** Design steps: basics (project, name), then the request and the agent. */
export type DesignDraftStep = 1 | 2
export const DESIGN_DRAFT_LAST_STEP: DesignDraftStep = 2

export type DesignDraft = {
  step: DesignDraftStep
  /** "What are we building today?", sent verbatim to `design.create`. */
  request: string
}

export function createDesignDraft(): DesignDraft {
  return { step: 1, request: '' }
}

// Why the goal set: their argv prompt survives Claude's trust dialog (host pre-accepts it) and
// they run shell commands from a terminal TUI, which `dolphin design start` needs.
export function isDesignAgent(agent: TuiAgent | null): agent is AutonomousGoalAgent {
  return isAutonomousGoalAgent(agent)
}

export function designNameIsValid(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= DESIGN_NAME_MAX_CHARS
}

export function designRequestIsValid(request: string): boolean {
  const trimmed = request.trim()
  return trimmed.length > 0 && trimmed.length <= DESIGN_REQUEST_MAX_CHARS
}

/** True while the design cannot be created yet; it is created only from the last step. */
export function designDraftBlocksCreate(
  draft: DesignDraft,
  input: { name: string; agent: TuiAgent | null }
): boolean {
  return (
    draft.step !== DESIGN_DRAFT_LAST_STEP ||
    !designNameIsValid(input.name) ||
    !designRequestIsValid(draft.request) ||
    !isDesignAgent(input.agent)
  )
}
