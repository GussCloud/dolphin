import { describe, expect, it, vi } from 'vitest'
import { resolveWorkerBriefLaunchPrompt, watchWorkerStartupBlock } from './worker-brief-launch'

const runtime = { getWorktreeOrchestrationCliCommand: vi.fn(() => 'dolphin-ide' as const) }

function promptFor(overrides: Partial<Parameters<typeof resolveWorkerBriefLaunchPrompt>[0]> = {}) {
  return resolveWorkerBriefLaunchPrompt({
    runtime,
    agent: 'claude-agent-teams',
    params: {},
    placement: { id: 'repo::C:/w', repoId: 'repo' },
    createsWorktree: true,
    dispatchId: 'ctx_1',
    task: { id: 'task_1', spec: 'Build the login\nwith tests' },
    ...overrides
  })
}

describe('resolveWorkerBriefLaunchPrompt', () => {
  it('carries the worker-brief pointer for the host CLI on one line', () => {
    const prompt = promptFor()
    expect(prompt).toContain('`dolphin-ide orchestration worker-brief --dispatch ctx_1 --json`')
    expect(prompt).toContain('Your task ID is: task_1')
    expect(prompt).not.toContain('\n')
    expect(promptFor({ params: { devMode: true } })).toContain(
      '`dolphin-dev orchestration worker-brief'
    )
  })

  it('carries no character cmd.exe quoting would mangle, whatever the task says', () => {
    // Why: cmd keeps the ^ its quoting adds inside double quotes; the full spec goes by brief.
    const prompt = promptFor({
      task: { id: 'task_1', spec: '50% done & "quoted" (x) !bang | <a> ^c $HOME `cmd`' }
    })
    expect(prompt).not.toMatch(/[\^&|<>()%!"$]/)
    expect(prompt).toContain('50 done quoted x bang a c HOME cmd')
  })

  it.each(['claude', 'codex', 'deepseek', 'deepseek-agent-teams'] as const)(
    'launches %s with it',
    (agent) => {
      expect(promptFor({ agent })).toBeDefined()
    }
  )

  it('keeps the paste for a reused terminal, an unknown host or a non-argument agent', () => {
    expect(promptFor({ params: { terminal: 'term_x' } })).toBeUndefined()
    expect(promptFor({ placement: undefined })).toBeUndefined()
    // Another repo's host, and so its CLI name, is unknown until its worktree exists.
    expect(promptFor({ params: { repo: 'other' } })).toBeUndefined()
    expect(promptFor({ params: { repo: 'other' }, createsWorktree: false })).toBeDefined()
    expect(promptFor({ agent: 'aider' })).toBeUndefined()
    // AGY's interactive flag has its own readiness rules (antigravity-readiness-evidence.md).
    expect(promptFor({ agent: 'antigravity' })).toBeUndefined()
  })
})

describe('watchWorkerStartupBlock', () => {
  const wait = (result: Record<string, unknown>) => ({
    waitForTerminal: vi.fn(async () => ({
      handle: 'term_worker',
      condition: 'tui-idle' as const,
      exitCode: null,
      ...result
    }))
  })
  const watch = (result: Record<string, unknown>, onExited = vi.fn(() => 'setup_wait' as const)) =>
    watchWorkerStartupBlock({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the watch reads only these wait fields.
      runtime: wait(result) as never,
      terminalHandle: 'term_worker',
      timeoutMs: 1_000,
      onExited
    })

  it('fails a start held by a startup screen', async () => {
    await expect(
      watch({ satisfied: false, status: 'running', blockedReason: 'agent-trust-workspace' })
    ).resolves.toMatchObject({ stage: 'agent_readiness' })
  })

  it('lets a gated setup name the stage when the terminal exits', async () => {
    const onExited = vi.fn(() => 'setup_wait' as const)
    await expect(watch({ satisfied: false, status: 'exited' }, onExited)).resolves.toMatchObject({
      stage: 'setup_wait'
    })
    expect(onExited).toHaveBeenCalledOnce()
  })

  it('never fails an agent that is only busy on its launch prompt', async () => {
    await expect(watch({ satisfied: false, status: 'running' })).resolves.toBeNull()
    await expect(watch({ satisfied: true, status: 'running' })).resolves.toBeNull()
  })
})
