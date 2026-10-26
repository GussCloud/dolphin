import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import type { RuntimeClient } from '../runtime-client'
import { GOAL_HANDLERS } from './goal'
import { encodeAutonomousGoalObjective } from '../../shared/autonomous-coordinator-prompt'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'

vi.mock('./orchestration/terminal-identity', () => ({
  resolveCoordinatorTerminalHandle: vi.fn().mockResolvedValue('term_coord')
}))

const goal: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Build the app',
  agent: 'claude',
  workerAgent: 'codex',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'p',
  worktreeId: null,
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 1,
  updatedAt: 1
}

function context(
  json: boolean,
  call: ReturnType<typeof vi.fn>,
  extraFlags: [string, string | boolean][] = []
): HandlerContext {
  return {
    flags: new Map<string, string | boolean>([
      ['agent', 'claude'],
      ['worker-agent', 'codex'],
      ['objective-b64', encodeAutonomousGoalObjective('Build the app')],
      ...extraFlags
    ]),
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only calls `call`.
    client: { call } as unknown as RuntimeClient,
    cwd: '/repo',
    json
  }
}

describe('goal start', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Why: the launch prompt carries no rules, so a text-mode start must still print them.
  it('prints the coordinator instructions in text mode', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const call = vi.fn().mockResolvedValue({
      id: '1',
      ok: true,
      result: { goal, created: true, instructions: 'Rules:\n- coordinate' },
      _meta: { runtimeId: 'r' }
    })

    await GOAL_HANDLERS['goal start']!(context(false, call))

    expect(call).toHaveBeenCalledWith(
      'goal.start',
      expect.objectContaining({ from: 'term_coord', objective: 'Build the app' })
    )
    expect(log.mock.calls[0]?.[0]).toMatch(/^Goal started\.\n[\s\S]*\n\nRules:\n- coordinate$/)
  })

  it('sends cleanup choices only for the flags given, so older hosts keep their defaults', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const call = vi.fn().mockResolvedValue({ id: '1', ok: true, result: { goal, created: true } })

    await GOAL_HANDLERS['goal start']!(context(false, call))
    expect(call.mock.calls[0]?.[1]).not.toHaveProperty('removeWorktrees')
    expect(call.mock.calls[0]?.[1]).not.toHaveProperty('keepCoordinatorWorktree')

    await GOAL_HANDLERS['goal start']!(
      context(false, call, [
        ['keep-worktrees', true],
        ['remove-coordinator-worktree', true]
      ])
    )
    expect(call.mock.calls[1]?.[1]).toMatchObject({
      removeWorktrees: false,
      keepCoordinatorWorktree: false
    })
  })

  it('decodes the agent guidance flags and sends only the ones given', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const call = vi.fn().mockResolvedValue({ id: '1', ok: true, result: { goal, created: true } })

    await GOAL_HANDLERS['goal start']!(
      context(false, call, [
        ['agent-name-b64', encodeAutonomousGoalObjective('Revisor')],
        ['instructions-b64', encodeAutonomousGoalObjective('Não executar testes locais')]
      ])
    )
    expect(call.mock.calls[0]?.[1]).toMatchObject({
      agentName: 'Revisor',
      instructions: 'Não executar testes locais'
    })
    expect(call.mock.calls[0]?.[1]).not.toHaveProperty('strategy')

    await expect(
      GOAL_HANDLERS['goal start']!(context(false, call, [['strategy-b64', '%%%']]))
    ).rejects.toThrow('--strategy-b64 is not valid base64 UTF-8')
  })

  it('keeps working against a host that returns no instructions', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const call = vi.fn().mockResolvedValue({
      id: '1',
      ok: true,
      result: { goal, created: false },
      _meta: { runtimeId: 'r' }
    })

    await GOAL_HANDLERS['goal start']!(context(false, call))

    expect(log.mock.calls[0]?.[0]).toMatch(/^Goal already open\./)
    expect(log.mock.calls[0]?.[0]).not.toContain('Rules:')
  })
})

describe('goal show', () => {
  it('reports what the closing sweep removed and kept', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const call = vi.fn().mockResolvedValue({
      id: '1',
      ok: true,
      result: {
        goal: {
          ...goal,
          status: 'complete',
          cleanup: {
            removedWorktreeIds: ['wt-1', 'wt-2'],
            retained: [{ worktreeId: 'wt-3', reason: 'worktree has uncommitted changes' }],
            finishedAt: 5
          }
        }
      },
      _meta: { runtimeId: 'r' }
    })

    await GOAL_HANDLERS['goal show']!(context(false, call))

    expect(log.mock.calls[0]?.[0]).toContain(
      'cleanup: removed 2 worktree(s)\n  kept wt-3: worktree has uncommitted changes'
    )
    log.mockRestore()
  })
})
