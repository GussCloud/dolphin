// An autonomous goal: one coordinator agent pane driving an orchestration Run until the objective is met.
// The coordinator's memory lives here and in the Run, never in its context window, so the session can be rotated.

export const AUTONOMOUS_GOAL_AGENTS = [
  'claude',
  'claude-agent-teams',
  'codex',
  'deepseek',
  'deepseek-agent-teams'
] as const
export type AutonomousGoalAgent = (typeof AUTONOMOUS_GOAL_AGENTS)[number]

export const AUTONOMOUS_GOAL_CLIS = ['claude', 'codex'] as const
export type AutonomousGoalCli = (typeof AUTONOMOUS_GOAL_CLIS)[number]

/** The CLI a goal agent runs: its transcript format, hook source, reset command and plan follow it. */
export const AUTONOMOUS_GOAL_AGENT_CLI: Record<AutonomousGoalAgent, AutonomousGoalCli> = {
  claude: 'claude',
  'claude-agent-teams': 'claude',
  codex: 'codex',
  // Why: DeepSeek runs the Claude Code CLI with an isolated config dir; see docs/reference/deepseek-agent.md.
  deepseek: 'claude',
  'deepseek-agent-teams': 'claude'
}

/** The subscription plan an agent draws on; null for API-billed agents, which have no window to guard. */
export const AUTONOMOUS_GOAL_AGENT_PLAN: Record<AutonomousGoalAgent, AutonomousGoalCli | null> = {
  claude: 'claude',
  'claude-agent-teams': 'claude',
  codex: 'codex',
  deepseek: null,
  'deepseek-agent-teams': null
}

/** Agents that can spawn Agent Teams teammates. */
export const AUTONOMOUS_GOAL_TEAMS_AGENTS: readonly AutonomousGoalAgent[] = [
  'claude-agent-teams',
  'deepseek-agent-teams'
]

export function isAutonomousGoalTeamsAgent(agent: AutonomousGoalAgent): boolean {
  return AUTONOMOUS_GOAL_TEAMS_AGENTS.includes(agent)
}

export function isAutonomousGoalCli(value: unknown): value is AutonomousGoalCli {
  return AUTONOMOUS_GOAL_CLIS.some((cli) => cli === value)
}

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

/** What the host removed once the goal's workers were done, and what it left and why. */
export type AutonomousGoalCleanup = {
  removedWorktreeIds: string[]
  retained: { worktreeId: string; reason: string }[]
  /** Set once the closing sweep ran, so a restart does not repeat it. */
  finishedAt?: number
}

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
  cleanup?: AutonomousGoalCleanup
  /** The coordinator worktree's create base; workers branch from it and their PRs target it. */
  baseRef?: string
  /** Absent means true: settled workers are released and their worktrees removed. */
  removeWorktrees?: boolean
  /** Absent means true: the coordinator's own worktree survives a completed goal. */
  keepCoordinatorWorktree?: boolean
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

/** Whether this goal's host-side cleanup releases and removes anything at all. */
export function autonomousGoalRemovesWorktrees(goal: Pick<AutonomousGoal, 'removeWorktrees'>) {
  return goal.removeWorktrees !== false
}

/** Whether a completed goal also removes the coordinator's own worktree. */
export function autonomousGoalRemovesCoordinatorWorktree(
  goal: Pick<AutonomousGoal, 'removeWorktrees' | 'keepCoordinatorWorktree'>
) {
  return autonomousGoalRemovesWorktrees(goal) && goal.keepCoordinatorWorktree === false
}
