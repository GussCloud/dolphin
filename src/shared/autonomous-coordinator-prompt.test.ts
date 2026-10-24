import { describe, expect, it } from 'vitest'
import { AUTONOMOUS_GOAL_AGENT_CLI, type AutonomousGoal } from './autonomous-goal-types'
import {
  AUTONOMOUS_COORDINATOR_RESET_COMMAND,
  buildAutonomousCoordinatorLaunchPrompt,
  buildAutonomousCoordinatorResumePrompt,
  decodeAutonomousGoalObjective,
  encodeAutonomousGoalObjective
} from './autonomous-coordinator-prompt'

describe('autonomous goal objective encoding', () => {
  it('round-trips multi-line UTF-8 text through shell-safe base64', () => {
    const objective = 'Analisar a documentação "docs/" e seguir com o desenvolvimento\n- passo 2 ✓'
    const encoded = encodeAutonomousGoalObjective(objective)
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(decodeAutonomousGoalObjective(encoded)).toBe(objective)
  })

  it('rejects bytes that are not UTF-8', () => {
    expect(() => decodeAutonomousGoalObjective(btoa('\xff\xfe'))).toThrow()
  })
})

describe('buildAutonomousCoordinatorLaunchPrompt', () => {
  it('binds the goal first and carries the worker policy', () => {
    const prompt = buildAutonomousCoordinatorLaunchPrompt({
      objective: '  Build the app  ',
      agent: 'claude',
      workerAgent: 'codex',
      maxConcurrent: 3
    })
    const encoded = encodeAutonomousGoalObjective('Build the app')
    expect(prompt).toContain(
      `dolphin goal start --agent claude --worker-agent codex --max-concurrent 3 --objective-b64 ${encoded} --json`
    )
    expect(prompt).toContain('--agent codex --json`. Keep at most 3 workers running.')
    expect(prompt).toContain('enable auto-merge')
    expect(prompt).toContain('dolphin goal complete')
    expect(prompt.indexOf('dolphin goal start')).toBeLessThan(prompt.indexOf('Rules:'))
  })
})

describe('buildAutonomousCoordinatorResumePrompt', () => {
  const goal: AutonomousGoal = {
    id: 'goal_1',
    objective: 'Build the app',
    agent: 'claude',
    workerAgent: 'codex',
    maxConcurrent: 2,
    status: 'active',
    paneKey: 'p',
    worktreeId: null,
    runId: 'run_9',
    notes: [
      { kind: 'decision', text: 'Use SQLite', at: 1 },
      { kind: 'handoff', text: 'Was about to start task_3', at: 2 }
    ],
    rotations: 1,
    createdAt: 1,
    updatedAt: 2
  }

  it('restates goal, Run, task table and notes without re-binding', () => {
    const prompt = buildAutonomousCoordinatorResumePrompt(goal, [
      { id: 'task_1', status: 'completed', spec: 'Scaffold   the\nproject' },
      { id: 'task_2', status: 'dispatched', spec: 'x'.repeat(300) }
    ])
    expect(prompt).toContain('Run: run_9.')
    expect(prompt).toContain('- task_1 [completed] Scaffold the project')
    expect(prompt).toMatch(/- task_2 \[dispatched\] x{99}…/)
    expect(prompt).toContain('- Use SQLite')
    expect(prompt).toContain('- Was about to start task_3')
    expect(prompt).toContain('do not run `dolphin goal start`')
    expect(prompt).not.toContain('--objective-b64')
  })

  it('caps the task table so a large plan keeps the prompt bounded', () => {
    const tasks = Array.from({ length: 55 }, (_, index) => ({
      id: `task_${index}`,
      status: 'ready',
      spec: 'work'
    }))
    const prompt = buildAutonomousCoordinatorResumePrompt(goal, tasks)
    expect(prompt).toContain('- … 15 more')
    expect(prompt).not.toContain('task_54')
  })
})

describe('Claude Agent Teams goals', () => {
  it('keeps a Teams coordinator off teammates and lets Teams workers use them', () => {
    const prompt = buildAutonomousCoordinatorLaunchPrompt({
      objective: 'Ship',
      agent: 'claude-agent-teams',
      workerAgent: 'claude-agent-teams',
      maxConcurrent: 2
    })
    expect(prompt).toContain('--agent claude-agent-teams --worker-agent claude-agent-teams')
    expect(prompt).toContain('Do not spawn Agent Teams teammates from this coordinator')
    expect(prompt).toContain('Workers run Agent Teams')
  })

  it('applies the same Teams rules to DeepSeek Agent Teams', () => {
    const prompt = buildAutonomousCoordinatorLaunchPrompt({
      objective: 'Ship',
      agent: 'deepseek-agent-teams',
      workerAgent: 'deepseek-agent-teams',
      maxConcurrent: 2
    })
    expect(prompt).toContain('--agent deepseek-agent-teams --worker-agent deepseek-agent-teams')
    expect(prompt).toContain('Do not spawn Agent Teams teammates from this coordinator')
    expect(prompt).toContain('Workers run Agent Teams')
  })

  it('omits the Teams rules for other agents', () => {
    const prompt = buildAutonomousCoordinatorLaunchPrompt({
      objective: 'Ship',
      agent: 'claude',
      workerAgent: 'codex',
      maxConcurrent: 2
    })
    expect(prompt).not.toContain('Agent Teams')
  })

  it('resets a Teams coordinator with the Claude command', () => {
    expect(
      AUTONOMOUS_COORDINATOR_RESET_COMMAND[AUTONOMOUS_GOAL_AGENT_CLI['claude-agent-teams']]
    ).toBe('/clear')
  })
})
