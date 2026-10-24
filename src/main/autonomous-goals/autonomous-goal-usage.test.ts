import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProviderRateLimits, RateLimitState } from '../../shared/rate-limit-types'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import { AutonomousGoalStore } from './autonomous-goal-store'
import {
  AUTONOMOUS_GOAL_UNKNOWN_RESET_RETRY_MS,
  assertAutonomousGoalWithinUsage,
  evaluateAutonomousGoalUsage,
  setAutonomousGoalRateLimitReader
} from './autonomous-goal-usage'

const NOW = 1_000_000

function limits(
  provider: 'claude' | 'codex',
  session: number,
  weekly = 0,
  resetsAt: number | null = NOW + 3_600_000
): ProviderRateLimits {
  const window = (usedPercent: number, windowMinutes: number) => ({
    usedPercent,
    windowMinutes,
    resetsAt,
    resetDescription: null
  })
  return {
    provider,
    session: window(session, 300),
    weekly: window(weekly, 10_080),
    updatedAt: NOW,
    error: null,
    status: 'ok'
  }
}

function state(
  claude: ProviderRateLimits | null,
  codex: ProviderRateLimits | null
): Pick<RateLimitState, 'claude' | 'codex'> {
  return { claude, codex }
}

describe('autonomous goal usage guard', () => {
  it('pauses on whichever of the coordinator or worker plans is near its window end', () => {
    const goal: Pick<AutonomousGoal, 'agent' | 'workerAgent'> = {
      agent: 'claude',
      workerAgent: 'codex'
    }
    expect(
      evaluateAutonomousGoalUsage(goal, state(limits('claude', 50), limits('codex', 40)), NOW)
    ).toEqual({
      limited: false
    })
    expect(
      evaluateAutonomousGoalUsage(goal, state(limits('claude', 50), limits('codex', 90)), NOW)
    ).toMatchObject({ limited: true, cli: 'codex', resumeAt: NOW + 3_600_000 })
    expect(
      evaluateAutonomousGoalUsage(
        { agent: 'claude-agent-teams', workerAgent: 'claude-agent-teams' },
        state(limits('claude', 90), limits('codex', 99)),
        NOW
      )
    ).toMatchObject({ limited: true, cli: 'claude' })
    expect(
      evaluateAutonomousGoalUsage(goal, state(limits('claude', 10, 96, null), null), NOW)
    ).toMatchObject({ limited: true, resumeAt: NOW + AUTONOMOUS_GOAL_UNKNOWN_RESET_RETRY_MS })
    expect(evaluateAutonomousGoalUsage(goal, null, NOW)).toEqual({ limited: false })
  })

  describe('worker-start enforcement', () => {
    let dir: string
    let store: AutonomousGoalStore
    let current: Pick<RateLimitState, 'claude' | 'codex'>

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'goal-usage-'))
      store = new AutonomousGoalStore(() => join(dir, 'goals.json'))
      current = state(limits('claude', 90), null)
      setAutonomousGoalRateLimitReader(() => current)
    })

    afterEach(() => {
      setAutonomousGoalRateLimitReader(null)
      rmSync(dir, { recursive: true, force: true })
    })

    it('refuses a worker, marks the goal usage-limited, then clears it once usage drops', () => {
      const goal = store.create({
        objective: 'x',
        agent: 'claude',
        workerAgent: 'claude',
        maxConcurrent: 1,
        paneKey: 'p',
        worktreeId: null,
        runId: 'run_1'
      })
      expect(() => assertAutonomousGoalWithinUsage(() => store, 'run_1', NOW)).toThrow(
        /90% of its usage window/
      )
      expect(store.get(goal.id)).toMatchObject({
        status: 'usageLimited',
        usageResumeAt: NOW + 3_600_000
      })
      current = state(limits('claude', 10), null)
      assertAutonomousGoalWithinUsage(() => store, 'run_1', NOW)
      expect(store.get(goal.id)?.status).toBe('active')
    })

    it('never touches a Run that belongs to no goal', () => {
      expect(() => assertAutonomousGoalWithinUsage(() => store, 'run_other', NOW)).not.toThrow()
    })
  })
})
