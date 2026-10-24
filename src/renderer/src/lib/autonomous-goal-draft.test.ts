import { describe, expect, it } from 'vitest'
import {
  autonomousGoalDraftBlocksCreate,
  createAutonomousGoalDraft,
  resolveAutonomousGoalLaunchPrompt
} from './autonomous-goal-draft'

describe('autonomous goal draft', () => {
  it('does nothing while switched off', () => {
    const draft = createAutonomousGoalDraft('codex')
    expect(draft.workerAgent).toBe('codex')
    expect(autonomousGoalDraftBlocksCreate(draft, 'gemini')).toBe(false)
    expect(resolveAutonomousGoalLaunchPrompt(draft, 'claude')).toBeNull()
  })

  it('blocks create until a supported coordinator has an objective', () => {
    const draft = { ...createAutonomousGoalDraft('claude'), enabled: true }
    expect(autonomousGoalDraftBlocksCreate(draft, 'claude')).toBe(true)
    const withGoal = { ...draft, objective: 'Implement docs/spec.md' }
    expect(autonomousGoalDraftBlocksCreate(withGoal, 'gemini')).toBe(true)
    expect(autonomousGoalDraftBlocksCreate(withGoal, 'claude')).toBe(false)
    expect(resolveAutonomousGoalLaunchPrompt(withGoal, 'claude')).toContain('dolphin goal start')
  })
})
