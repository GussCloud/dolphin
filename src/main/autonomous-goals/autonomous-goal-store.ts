import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import {
  AUTONOMOUS_GOAL_MAX_DECISIONS,
  AUTONOMOUS_GOAL_NOTE_MAX_CHARS,
  isAutonomousGoalAgent,
  isAutonomousGoalNoteKind,
  isAutonomousGoalStatus,
  isAutonomousGoalOpen,
  type AutonomousGoal,
  type AutonomousGoalNote,
  type AutonomousGoalNoteKind
} from '../../shared/autonomous-goal-types'

const MAX_GOALS = 100

export type AutonomousGoalCreate = Pick<
  AutonomousGoal,
  'objective' | 'agent' | 'workerAgent' | 'maxConcurrent' | 'paneKey' | 'worktreeId' | 'runId'
> &
  Partial<Pick<AutonomousGoal, 'removeWorktrees' | 'keepCoordinatorWorktree'>>

type GoalListener = (goal: AutonomousGoal) => void

/** One small JSON file per host; the execution host owns its goals the way it owns its Runs. */
export class AutonomousGoalStore {
  private cache: AutonomousGoal[] | null = null
  private readonly listeners = new Set<GoalListener>()

  constructor(
    private readonly resolveFilePath: () => string,
    private readonly now: () => number = Date.now
  ) {}

  list(): AutonomousGoal[] {
    return [...this.read()]
  }

  get(id: string): AutonomousGoal | null {
    return this.read().find((goal) => goal.id === id) ?? null
  }

  /** The open goal a coordinator pane drives; a pane drives at most one at a time. */
  findOpenByPane(paneKey: string): AutonomousGoal | null {
    return (
      this.read().find((goal) => goal.paneKey === paneKey && isAutonomousGoalOpen(goal)) ?? null
    )
  }

  findOpenByRun(runId: string): AutonomousGoal | null {
    return this.read().find((goal) => goal.runId === runId && isAutonomousGoalOpen(goal)) ?? null
  }

  create(input: AutonomousGoalCreate): AutonomousGoal {
    const at = this.now()
    const goal: AutonomousGoal = {
      ...input,
      id: `goal_${randomUUID().slice(0, 12)}`,
      status: 'active',
      notes: [],
      rotations: 0,
      createdAt: at,
      updatedAt: at
    }
    this.write([...this.read(), goal])
    this.emit(goal)
    return goal
  }

  update(id: string, patch: Partial<Omit<AutonomousGoal, 'id' | 'createdAt'>>): AutonomousGoal {
    const goals = this.read()
    const index = goals.findIndex((goal) => goal.id === id)
    if (index === -1) {
      throw new Error('goal_not_found')
    }
    const next: AutonomousGoal = { ...goals[index], ...patch, updatedAt: this.now() }
    const updated = [...goals]
    updated[index] = next
    this.write(updated)
    this.emit(next)
    return next
  }

  addNote(id: string, kind: AutonomousGoalNoteKind, text: string): AutonomousGoal {
    const goal = this.get(id)
    if (!goal) {
      throw new Error('goal_not_found')
    }
    const note: AutonomousGoalNote = {
      kind,
      text: text.trim().slice(0, AUTONOMOUS_GOAL_NOTE_MAX_CHARS),
      at: this.now()
    }
    return this.update(id, { notes: appendNote(goal.notes, note) })
  }

  subscribe(listener: GoalListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(goal: AutonomousGoal): void {
    for (const listener of this.listeners) {
      try {
        listener(goal)
      } catch (error) {
        console.error('[autonomous-goals] listener threw', error)
      }
    }
  }

  private read(): AutonomousGoal[] {
    if (this.cache) {
      return this.cache
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.resolveFilePath(), 'utf-8'))
    } catch {
      parsed = []
    }
    this.cache = Array.isArray(parsed) ? parsed.filter(isStoredGoal) : []
    return this.cache
  }

  private write(goals: AutonomousGoal[]): void {
    // Why: closed goals are history; open ones are never evicted by the cap.
    const open = goals.filter(isAutonomousGoalOpen)
    const closed = goals.filter((goal) => !isAutonomousGoalOpen(goal))
    const kept = [...open, ...closed.slice(-Math.max(0, MAX_GOALS - open.length))].sort(
      (a, b) => a.createdAt - b.createdAt
    )
    writeFileAtomically(this.resolveFilePath(), JSON.stringify(kept), { mode: 0o600 })
    this.cache = kept
  }
}

/** Decisions accumulate up to a cap; a handoff or blocker replaces its predecessor. */
export function appendNote(
  notes: readonly AutonomousGoalNote[],
  note: AutonomousGoalNote
): AutonomousGoalNote[] {
  if (note.kind !== 'decision') {
    return [...notes.filter((existing) => existing.kind !== note.kind), note]
  }
  const decisions = [...notes.filter((existing) => existing.kind === 'decision'), note].slice(
    -AUTONOMOUS_GOAL_MAX_DECISIONS
  )
  return [...decisions, ...notes.filter((existing) => existing.kind !== 'decision')]
}

function isStoredNote(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    isAutonomousGoalNoteKind(value.kind) &&
    'text' in value &&
    typeof value.text === 'string' &&
    'at' in value &&
    typeof value.at === 'number'
  )
}

function isStoredGoal(value: unknown): value is AutonomousGoal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'objective' in value &&
    typeof value.objective === 'string' &&
    'agent' in value &&
    isAutonomousGoalAgent(value.agent) &&
    'workerAgent' in value &&
    isAutonomousGoalAgent(value.workerAgent) &&
    'maxConcurrent' in value &&
    typeof value.maxConcurrent === 'number' &&
    'paneKey' in value &&
    typeof value.paneKey === 'string' &&
    'runId' in value &&
    typeof value.runId === 'string' &&
    'status' in value &&
    isAutonomousGoalStatus(value.status) &&
    'notes' in value &&
    Array.isArray(value.notes) &&
    value.notes.every(isStoredNote) &&
    'rotations' in value &&
    typeof value.rotations === 'number' &&
    'createdAt' in value &&
    typeof value.createdAt === 'number' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  )
}
