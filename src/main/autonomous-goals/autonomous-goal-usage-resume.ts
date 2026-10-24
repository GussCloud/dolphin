// Wakes usage-limited goals when their plan window resets. Timers are rebuilt from the stored
// `usageResumeAt` on every start, so a restart while paused still resumes on time.
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import type { AgentPaneTextResult } from '../agent-pane-text-delivery'

export const AUTONOMOUS_GOAL_USAGE_RESUME_NOTICE =
  'Dolphin: the plan usage window has reset and this goal is active again. Read mail with `dolphin orchestration check --json`, start the ready Tasks, then end your turn.'
/** Lets the provider's own counters settle past the reset before workers start again. */
export const AUTONOMOUS_GOAL_USAGE_RESUME_GRACE_MS = 60_000
/** setTimeout's ceiling; a later reset re-arms on the next check. */
const MAX_TIMER_MS = 2 ** 31 - 1

export type AutonomousGoalUsageResumePorts = {
  listGoals: () => AutonomousGoal[]
  subscribe: (listener: (goal: AutonomousGoal) => void) => () => void
  markActive: (goalId: string) => void
  resolveTerminalHandle: (paneKey: string) => string | null
  sendPrompt: (terminal: string, text: string) => Promise<AgentPaneTextResult>
  now?: () => number
  schedule?: (run: () => void, ms: number) => () => void
}

function defaultSchedule(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

export function startAutonomousGoalUsageResume(ports: AutonomousGoalUsageResumePorts): () => void {
  const schedule = ports.schedule ?? defaultSchedule
  const now = ports.now ?? Date.now
  const timers = new Map<string, { resumeAt: number; cancel: () => void }>()

  function clear(goalId: string): void {
    timers.get(goalId)?.cancel()
    timers.delete(goalId)
  }

  async function resume(goalId: string): Promise<void> {
    timers.delete(goalId)
    const goal = ports.listGoals().find((candidate) => candidate.id === goalId)
    if (!goal || goal.status !== 'usageLimited' || goal.usageResumeAt === undefined) {
      return
    }
    if (goal.usageResumeAt + AUTONOMOUS_GOAL_USAGE_RESUME_GRACE_MS > now()) {
      arm(goal)
      return
    }
    ports.markActive(goal.id)
    const terminal = ports.resolveTerminalHandle(goal.paneKey)
    if (terminal) {
      // Why: best effort; if the pane is gone the next Run mail or the user restarts it.
      await ports.sendPrompt(terminal, AUTONOMOUS_GOAL_USAGE_RESUME_NOTICE).catch(() => 'unknown')
    }
  }

  function arm(goal: AutonomousGoal): void {
    if (goal.status !== 'usageLimited' || goal.usageResumeAt === undefined) {
      clear(goal.id)
      return
    }
    const resumeAt = goal.usageResumeAt + AUTONOMOUS_GOAL_USAGE_RESUME_GRACE_MS
    if (timers.get(goal.id)?.resumeAt === resumeAt) {
      return
    }
    clear(goal.id)
    const delay = Math.min(MAX_TIMER_MS, Math.max(0, resumeAt - now()))
    timers.set(goal.id, { resumeAt, cancel: schedule(() => void resume(goal.id), delay) })
  }

  for (const goal of ports.listGoals()) {
    arm(goal)
  }
  const unsubscribe = ports.subscribe(arm)
  return () => {
    unsubscribe()
    for (const goalId of timers.keys()) {
      clear(goalId)
    }
  }
}
