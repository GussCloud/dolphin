import { describe, expect, it } from 'vitest'
import { AUTONOMOUS_GOAL_AGENT_CLI, type AutonomousGoal } from './autonomous-goal-types'
import {
  AUTONOMOUS_COORDINATOR_RESET_COMMAND,
  buildAutonomousCoordinatorInstructions,
  buildAutonomousCoordinatorLaunchPrompt,
  buildAutonomousCoordinatorResumePrompt,
  decodeAutonomousGoalObjective,
  encodeAutonomousGoalObjective,
  autonomousGoalReviewTarget
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
  it('only binds the goal, so the rules never cross a shell', () => {
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
    expect(prompt).toContain('instructions field')
    expect(prompt).not.toContain('Rules:')
  })

  it('adds a cleanup flag only for a choice that differs from the defaults', () => {
    const launch = {
      objective: 'Ship',
      agent: 'claude' as const,
      workerAgent: 'claude' as const,
      maxConcurrent: 2
    }
    // Why: a host without these flags must still accept the default launch.
    expect(buildAutonomousCoordinatorLaunchPrompt(launch)).not.toContain('worktree')
    expect(
      buildAutonomousCoordinatorLaunchPrompt({
        ...launch,
        removeWorktrees: true,
        keepCoordinatorWorktree: true
      })
    ).not.toContain('worktree')
    expect(
      buildAutonomousCoordinatorLaunchPrompt({ ...launch, keepCoordinatorWorktree: false })
    ).toContain(' --remove-coordinator-worktree --json')
    expect(
      buildAutonomousCoordinatorLaunchPrompt({
        ...launch,
        removeWorktrees: false,
        keepCoordinatorWorktree: false
      })
    ).toContain(' --keep-worktrees --json')
  })

  it('stays one line of characters no shell quotes or splits differently', () => {
    // Why: PowerShell 5.1 drops embedded double quotes for native commands and cmd.exe ends a
    // command at a newline; a prompt with either never reached the coordinator on Windows.
    const prompt = buildAutonomousCoordinatorLaunchPrompt({
      objective: 'Analise "docs/" & siga <passo> | 100% \'pronto\'\nlinha 2 ✓ `x` $(y)',
      agent: 'deepseek-agent-teams',
      workerAgent: 'claude-agent-teams',
      maxConcurrent: 6
    })
    expect(prompt).toMatch(/^[A-Za-z0-9 .,:+/=-]+$/)
  })
})

describe('autonomousGoalReviewTarget', () => {
  it('names the branch a PR targets, without the remote', () => {
    expect(autonomousGoalReviewTarget('origin/develop')).toBe('develop')
    expect(autonomousGoalReviewTarget('refs/remotes/origin/release/2.0')).toBe('release/2.0')
    expect(autonomousGoalReviewTarget('main')).toBe('main')
    expect(autonomousGoalReviewTarget(undefined)).toBeUndefined()
  })

  it('keeps the provider default when the goal has no recorded base', () => {
    const rules = buildAutonomousCoordinatorInstructions({
      objective: 'Ship',
      agent: 'claude',
      workerAgent: 'claude',
      maxConcurrent: 2
    })
    expect(rules).toContain('open a PR (or MR), drive')
    expect(rules).not.toContain('--base-branch')
  })
})

describe('buildAutonomousCoordinatorInstructions', () => {
  it('restates the goal and carries the worker policy', () => {
    const instructions = buildAutonomousCoordinatorInstructions({
      objective: 'Build the app',
      agent: 'claude',
      workerAgent: 'codex',
      maxConcurrent: 3
    })
    expect(instructions).toContain('Goal:\nBuild the app')
    expect(instructions).toContain('--agent codex --json`. Keep at most 3 workers running.')
    expect(instructions).toContain('enable auto-merge')
    expect(instructions).toContain('dolphin goal complete')
    expect(instructions).not.toContain('--objective-b64')
  })

  it('carries its own short command set instead of the full orchestration guide', () => {
    const instructions = buildAutonomousCoordinatorInstructions({
      objective: 'Build the app',
      agent: 'claude',
      workerAgent: 'codex',
      maxConcurrent: 2
    })
    // Why: the full guide teaches `check --wait`, which these rules forbid, and costs ~3k tokens a session.
    expect(instructions).not.toContain('skills get orchestration')
    expect(instructions).toContain('--worktree new-child')
    expect(instructions).toContain('dolphin orchestration reply --id <message_id>')
    expect(instructions).toContain('--retry-of <dispatch_id>')
    expect(instructions).toContain('dolphin orchestration worker-list --json')
    expect(instructions.length).toBeLessThan(6_000)
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
  it('keeps a Teams coordinator off teammates and has every Teams worker spec require them', () => {
    const prompt = buildAutonomousCoordinatorInstructions({
      objective: 'Ship',
      agent: 'claude-agent-teams',
      workerAgent: 'claude-agent-teams',
      maxConcurrent: 2
    })
    expect(prompt).toContain('Do not spawn Agent Teams teammates from this coordinator')
    expect(prompt).toContain('each spec must tell the worker to split its Task across teammates')
  })

  it('applies the same Teams rules to DeepSeek Agent Teams', () => {
    const prompt = buildAutonomousCoordinatorInstructions({
      objective: 'Ship',
      agent: 'deepseek-agent-teams',
      workerAgent: 'deepseek-agent-teams',
      maxConcurrent: 2
    })
    expect(prompt).toContain('Do not spawn Agent Teams teammates from this coordinator')
    expect(prompt).toContain('Workers run Agent Teams')
  })

  it('omits the Teams rules for other agents', () => {
    const prompt = buildAutonomousCoordinatorInstructions({
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
