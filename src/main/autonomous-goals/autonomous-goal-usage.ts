// Plan-quota guard for autonomous goals. Subscription plans meter usage in windows, not money, so
// the guard pauses new workers near a window's end and resumes the goal when the window resets.
import type { ProviderRateLimits, RateLimitState } from '../../shared/rate-limit-types'
import type { AutonomousGoal, AutonomousGoalAgent } from '../../shared/autonomous-goal-types'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import type { AutonomousGoalStore } from './autonomous-goal-store'

export const AUTONOMOUS_GOAL_SESSION_PAUSE_PERCENT = 85
export const AUTONOMOUS_GOAL_WEEKLY_PAUSE_PERCENT = 95
/** When a window reports no reset time, look again after this long. */
export const AUTONOMOUS_GOAL_UNKNOWN_RESET_RETRY_MS = 30 * 60_000

export type AutonomousGoalUsageVerdict =
  | { limited: false }
  | { limited: true; agent: AutonomousGoalAgent; usedPercent: number; resumeAt: number }

let readRateLimits: (() => Pick<RateLimitState, AutonomousGoalAgent> | null) | null = null

/** Wired at startup; until then (and on hosts without usage data) the guard never blocks. */
export function setAutonomousGoalRateLimitReader(
  reader: (() => Pick<RateLimitState, AutonomousGoalAgent> | null) | null
): void {
  readRateLimits = reader
}

function windowVerdict(
  agent: AutonomousGoalAgent,
  limits: ProviderRateLimits | null,
  now: number
): AutonomousGoalUsageVerdict {
  const windows = [
    { window: limits?.session ?? null, pauseAt: AUTONOMOUS_GOAL_SESSION_PAUSE_PERCENT },
    { window: limits?.weekly ?? null, pauseAt: AUTONOMOUS_GOAL_WEEKLY_PAUSE_PERCENT }
  ]
  for (const { window, pauseAt } of windows) {
    if (window && window.usedPercent >= pauseAt) {
      const resumeAt =
        window.resetsAt !== null && window.resetsAt > now
          ? window.resetsAt
          : now + AUTONOMOUS_GOAL_UNKNOWN_RESET_RETRY_MS
      return { limited: true, agent, usedPercent: window.usedPercent, resumeAt }
    }
  }
  return { limited: false }
}

/** Both the coordinator and its workers draw on a plan, so either one near its limit pauses. */
export function evaluateAutonomousGoalUsage(
  goal: Pick<AutonomousGoal, 'agent' | 'workerAgent'>,
  state: Pick<RateLimitState, AutonomousGoalAgent> | null,
  now: number
): AutonomousGoalUsageVerdict {
  if (!state) {
    return { limited: false }
  }
  let latest: AutonomousGoalUsageVerdict = { limited: false }
  for (const agent of new Set([goal.agent, goal.workerAgent])) {
    const verdict = windowVerdict(agent, state[agent], now)
    if (verdict.limited && (!latest.limited || verdict.resumeAt > latest.resumeAt)) {
      latest = verdict
    }
  }
  return latest
}

/** Called before a goal's coordinator starts a worker; refuses and pauses the goal when near a limit. */
export function assertAutonomousGoalWithinUsage(
  getStore: () => AutonomousGoalStore,
  runId: string,
  now: number = Date.now()
): void {
  // Why: without a usage source there is nothing to enforce, so the store is not even opened.
  if (!readRateLimits) {
    return
  }
  const store = getStore()
  const goal = store.findOpenByRun(runId)
  if (!goal) {
    return
  }
  const verdict = evaluateAutonomousGoalUsage(goal, readRateLimits(), now)
  if (!verdict.limited) {
    if (goal.status === 'usageLimited') {
      store.update(goal.id, { status: 'active', usageResumeAt: undefined })
    }
    return
  }
  store.update(goal.id, { status: 'usageLimited', usageResumeAt: verdict.resumeAt })
  throw new OrchestrationError(
    'goal_usage_limited',
    `The ${verdict.agent} plan is at ${Math.round(verdict.usedPercent)}% of its usage window. No new workers until ${new Date(verdict.resumeAt).toISOString()}; Dolphin will notify this terminal then. Finish handling current mail and end your turn.`,
    { effectsApplied: false, resumeAt: verdict.resumeAt }
  )
}
