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
    input.agent === null
  )
}

/** "Create more" clears the name, which lives on the basics step, so the next design starts there. */
export function designDraftForName(draft: DesignDraft, name: string): DesignDraft {
  return draft.step === DESIGN_DRAFT_LAST_STEP && name.trim().length === 0
    ? { ...draft, step: 1 }
    : draft
}

// Why: only provisioned-root recipes are guaranteed SSH, whose `dolphin` CLI bridges back to this
// runtime; a recipe-made Dolphin server runs its own runtime, which never has the design record.
export function designEphemeralVmRecipes<T extends { checkoutMode?: string }>(
  recipes: readonly T[]
): T[] {
  return recipes.filter((recipe) => recipe.checkoutMode === 'provisioned-root')
}
