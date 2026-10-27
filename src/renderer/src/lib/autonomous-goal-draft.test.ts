import { describe, expect, it } from 'vitest'
import { encodeAutonomousGoalObjective } from '../../../shared/autonomous-coordinator-prompt'
import { DEFAULT_ORCHESTRATION_AGENT } from '../../../shared/orchestration-agent-profiles'
import {
  applyOrchestrationAgentToDraft,
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
    const draft = { ...createAutonomousGoalDraft('claude'), enabled: true, step: 4 as const }
    expect(autonomousGoalDraftBlocksCreate(draft, 'claude')).toBe(true)
    const withGoal = { ...draft, objective: 'Implement docs/spec.md' }
    expect(autonomousGoalDraftBlocksCreate(withGoal, 'gemini')).toBe(true)
    expect(autonomousGoalDraftBlocksCreate(withGoal, 'claude')).toBe(false)
    expect(resolveAutonomousGoalLaunchPrompt(withGoal, 'claude')).toContain('dolphin goal start')
  })

  it('removes worktrees but keeps the main one by default, and launches the choice made', () => {
    const draft = {
      ...createAutonomousGoalDraft('claude'),
      enabled: true,
      step: 4 as const,
      objective: 'Implement docs/spec.md'
    }
    expect(draft).toMatchObject({ removeWorktrees: true, keepCoordinatorWorktree: true })
    expect(resolveAutonomousGoalLaunchPrompt(draft, 'claude')).not.toContain('worktree')
    expect(
      resolveAutonomousGoalLaunchPrompt({ ...draft, keepCoordinatorWorktree: false }, 'claude')
    ).toContain('--remove-coordinator-worktree')
    expect(
      resolveAutonomousGoalLaunchPrompt({ ...draft, removeWorktrees: false }, 'claude')
    ).toContain('--keep-worktrees')
  })

  it('starts an orchestration only from the last step', () => {
    const draft = {
      ...createAutonomousGoalDraft('claude'),
      enabled: true,
      objective: 'Implement docs/spec.md'
    }
    expect(draft.step).toBe(1)
    expect(autonomousGoalDraftBlocksCreate({ ...draft, step: 3 }, 'claude')).toBe(true)
    expect(autonomousGoalDraftBlocksCreate({ ...draft, step: 4 }, 'claude')).toBe(false)
  })

  it('launches a picked agent with its name, strategy and the user instructions', () => {
    const draft = {
      ...createAutonomousGoalDraft('claude'),
      enabled: true,
      step: 4 as const,
      objective: 'Ship',
      instructions: 'Do not run tests locally.'
    }
    const agent = {
      ...DEFAULT_ORCHESTRATION_AGENT,
      id: 'reviewer',
      name: 'Reviewer',
      strategy: 'Small Tasks.',
      workerAgent: 'codex' as const,
      maxConcurrent: 4
    }
    const applied = applyOrchestrationAgentToDraft(draft, agent)
    expect(applied).toMatchObject({ agentId: 'reviewer', workerAgent: 'codex', maxConcurrent: 4 })
    const prompt = resolveAutonomousGoalLaunchPrompt(applied, 'claude', agent)
    expect(prompt).toContain(`--agent-name-b64 ${encodeAutonomousGoalObjective('Reviewer')}`)
    expect(prompt).toContain(`--strategy-b64 ${encodeAutonomousGoalObjective('Small Tasks.')}`)
    expect(prompt).toContain(
      `--instructions-b64 ${encodeAutonomousGoalObjective('Do not run tests locally.')}`
    )
    // Dolphin's own agent with no instructions launches exactly as before.
    const plain = resolveAutonomousGoalLaunchPrompt({ ...draft, instructions: '' }, 'claude')
    expect(plain).not.toContain('agent-name-b64')
    expect(plain).not.toContain('instructions-b64')
  })
})
