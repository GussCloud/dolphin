// An autonomous goal: one coordinator agent pane driving an orchestration Run until the objective is met.
// The coordinator's memory lives here and in the Run, never in its context window, so the session can be rotated.

export const AUTONOMOUS_GOAL_AGENTS = ['claude', 'codex'] as const
export type AutonomousGoalAgent = (typeof AUTONOMOUS_GOAL_AGENTS)[number]

// Why DeepSeek is absent: its launch gate and isolated config are not wired into goal workers yet.
export function isAutonomousGoalAgent(value: unknown): value is AutonomousGoalAgent {
  return AUTONOMOUS_GOAL_AGENTS.some((agent) => agent === value)
}

export const AUTONOMOUS_GOAL_STATUSES = [
  'active',
  'usageLimited',
  'blocked',
  'complete',
  'stopped'
] as const
export type AutonomousGoalStatus = (typeof AUTONOMOUS_GOAL_STATUSES)[number]

export function isAutonomousGoalStatus(value: unknown): value is AutonomousGoalStatus {
  return AUTONOMOUS_GOAL_STATUSES.some((status) => status === value)
}

export const AUTONOMOUS_GOAL_NOTE_KINDS = ['decision', 'handoff', 'blocker'] as const
export type AutonomousGoalNoteKind = (typeof AUTONOMOUS_GOAL_NOTE_KINDS)[number]

export function isAutonomousGoalNoteKind(value: unknown): value is AutonomousGoalNoteKind {
  return AUTONOMOUS_GOAL_NOTE_KINDS.some((kind) => kind === value)
}

export type AutonomousGoalNote = {
  kind: AutonomousGoalNoteKind
  text: string
  at: number
}

export const AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS = 8_000
export const AUTONOMOUS_GOAL_NOTE_MAX_CHARS = 1_500
/** Decisions kept for the resume prompt; older ones age out so the prompt stays bounded. */
export const AUTONOMOUS_GOAL_MAX_DECISIONS = 20
export const AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT = 2
export const AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT = 6

export type AutonomousGoal = {
  id: string
  objective: string
  agent: AutonomousGoalAgent
  workerAgent: AutonomousGoalAgent
  maxConcurrent: number
  status: AutonomousGoalStatus
  /** Coordinator pane; stable across an in-place session rotation. */
  paneKey: string
  worktreeId: string | null
  runId: string
  /** Decisions, newest last, then at most one handoff and one open blocker. */
  notes: AutonomousGoalNote[]
  rotations: number
  lastRotatedAt?: number
  summary?: string
  /** Set while usage-limited: when the plan window resets. */
  usageResumeAt?: number
  createdAt: number
  updatedAt: number
}

export function clampAutonomousGoalMaxConcurrent(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return AUTONOMOUS_GOAL_DEFAULT_MAX_CONCURRENT
  }
  return Math.min(AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT, Math.max(1, Math.floor(value)))
}

export function isAutonomousGoalOpen(goal: Pick<AutonomousGoal, 'status'>): boolean {
  return goal.status === 'active' || goal.status === 'usageLimited' || goal.status === 'blocked'
}
