import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import type { AgentStatusClearIpcPayload } from '../../shared/agent-status-types'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import { AUTONOMOUS_COORDINATOR_HANDOFF_REQUEST } from '../../shared/autonomous-coordinator-prompt'
import type { CoordinatorContextReading } from './autonomous-goal-context-probe'
import {
  AUTONOMOUS_GOAL_HANDOFF_TIMEOUT_MS,
  AUTONOMOUS_GOAL_RESET_SETTLE_MS,
  AUTONOMOUS_GOAL_ROTATE_FALLBACK_TURNS,
  AUTONOMOUS_GOAL_ROTATION_COOLDOWN_MS,
  rotationThreshold,
  startAutonomousGoalRotation
} from './autonomous-goal-rotation'

const PANE = 'tab-1:11111111-1111-4111-8111-111111111111'

const GOAL: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Ship',
  agent: 'claude',
  workerAgent: 'codex',
  maxConcurrent: 2,
  status: 'active',
  paneKey: PANE,
  worktreeId: 'wt-1',
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 1,
  updatedAt: 1
}

function harness(options: { contextTokens?: number | null; connectionId?: string | null } = {}) {
  let statusListener: (payload: EnrichedAgentHookEventPayload) => void = () => {}
  let clearListener: (clear: AgentStatusClearIpcPayload) => void = () => {}
  const ctx: {
    goal: AutonomousGoal | null
    lastInputAt: number | undefined
    sent: { kind: 'prompt' | 'command'; text: string }[]
    rotations: number
    reading: CoordinatorContextReading | null
  } = {
    goal: { ...GOAL },
    lastInputAt: undefined,
    sent: [],
    rotations: 0,
    reading:
      options.contextTokens === null ? null : { contextTokens: options.contextTokens ?? 150_000 }
  }
  const dispose = startAutonomousGoalRotation({
    subscribeEnrichedStatus: (listener) => {
      statusListener = listener
      return () => {}
    },
    subscribePaneStatusClear: (listener) => {
      clearListener = listener
      return () => {}
    },
    findOpenGoalByPane: (paneKey) => (paneKey === PANE ? ctx.goal : null),
    readContext: async () => ctx.reading,
    resolveTerminalHandle: () => 'term-1',
    readLastInputAt: () => ctx.lastInputAt,
    sendPrompt: async (_terminal, text) => {
      ctx.sent.push({ kind: 'prompt', text })
      return 'accepted'
    },
    sendCommand: async (_terminal, text) => {
      ctx.sent.push({ kind: 'command', text })
      return 'accepted'
    },
    buildResumePrompt: (goal) => `resume ${goal.id}`,
    recordRotation: () => {
      ctx.rotations += 1
    },
    now: () => Date.now()
  })
  let clock = 1_000
  const turnEnds = (overrides: Partial<EnrichedAgentHookEventPayload> = {}): void => {
    clock += 1
    const event: EnrichedAgentHookEventPayload = {
      paneKey: PANE,
      connectionId: options.connectionId === undefined ? null : options.connectionId,
      source: 'claude',
      hookEventName: 'Stop',
      providerSession: { key: 'session_id', id: 's1', transcriptPath: '/tmp/t.jsonl' },
      receivedAt: clock,
      stateStartedAt: clock,
      payload: {
        state: 'done',
        prompt: 'p',
        agentType: 'claude',
        mainAgent: { state: 'done', stateStartedAt: clock }
      },
      ...overrides
    }
    statusListener(event)
  }
  return { ctx, turnEnds, clear: () => clearListener({ paneKey: PANE }), dispose }
}

describe('autonomous goal session rotation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('asks for a handoff, resets in place and resumes from stored state', async () => {
    const h = harness()
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toEqual([{ kind: 'prompt', text: AUTONOMOUS_COORDINATOR_HANDOFF_REQUEST }])

    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent.at(-1)).toEqual({ kind: 'command', text: '/clear' })

    await vi.advanceTimersByTimeAsync(AUTONOMOUS_GOAL_RESET_SETTLE_MS)
    expect(h.ctx.sent.at(-1)).toEqual({ kind: 'prompt', text: 'resume goal_1' })
    expect(h.ctx.rotations).toBe(1)
  })

  it('uses /new for a Codex coordinator and rotates even without a handoff reply', async () => {
    const h = harness()
    h.ctx.goal = { ...GOAL, agent: 'codex' }
    h.turnEnds({ source: 'codex' })
    await vi.advanceTimersByTimeAsync(AUTONOMOUS_GOAL_HANDOFF_TIMEOUT_MS)
    expect(h.ctx.sent.at(-1)).toEqual({ kind: 'command', text: '/new' })
  })

  it('leaves a small context alone', async () => {
    const h = harness({ contextTokens: 20_000 })
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toEqual([])
  })

  it('backs off for the user when they type during the handoff', async () => {
    const h = harness()
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    h.ctx.lastInputAt = 42
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(AUTONOMOUS_GOAL_RESET_SETTLE_MS)
    expect(h.ctx.sent.map((entry) => entry.kind)).toEqual(['prompt'])
    expect(h.ctx.rotations).toBe(0)
  })

  it('falls back to a turn count when the transcript is on another host', async () => {
    const h = harness({ connectionId: 'ssh-1' })
    for (let turn = 1; turn < AUTONOMOUS_GOAL_ROTATE_FALLBACK_TURNS; turn += 1) {
      h.turnEnds()
    }
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toEqual([])
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toHaveLength(1)
  })

  it('does not rotate twice inside the cooldown, nor a usage-limited goal', async () => {
    const h = harness()
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(AUTONOMOUS_GOAL_RESET_SETTLE_MS)
    const sentAfterRotation = h.ctx.sent.length
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toHaveLength(sentAfterRotation)

    await vi.advanceTimersByTimeAsync(AUTONOMOUS_GOAL_ROTATION_COOLDOWN_MS)
    h.ctx.goal = { ...GOAL, status: 'usageLimited' }
    h.turnEnds()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toHaveLength(sentAfterRotation)
  })

  it('ignores panes that coordinate no goal and session-boundary dones', async () => {
    const h = harness()
    h.ctx.goal = null
    h.turnEnds()
    h.ctx.goal = { ...GOAL }
    h.turnEnds({
      payload: { state: 'done', prompt: 'p', agentType: 'claude', sessionBoundary: true }
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(h.ctx.sent).toEqual([])
  })

  it('rotates at the smaller of the absolute bound and a share of a stated window', () => {
    expect(rotationThreshold({ contextTokens: 0 })).toBe(120_000)
    expect(rotationThreshold({ contextTokens: 0, windowTokens: 1_000_000 })).toBe(120_000)
    expect(rotationThreshold({ contextTokens: 0, windowTokens: 128_000 })).toBe(76_800)
  })
})
