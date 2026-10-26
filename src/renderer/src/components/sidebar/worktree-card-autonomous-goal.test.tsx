// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type * as I18n from '@/i18n/i18n'
import type {
  AutonomousGoalListEntry,
  AutonomousGoalWorkerProgress
} from '../../../../shared/autonomous-goal-types'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? ''))
}))

const index = vi.hoisted(
  (): {
    goal: AutonomousGoalListEntry | null
    completed: AutonomousGoalListEntry | null
    worker: AutonomousGoalWorkerProgress | null
  } => ({ goal: null, completed: null, worker: null })
)
vi.mock('@/components/autonomous-goal/autonomous-goal-index', () => ({
  useCoordinatedAutonomousGoal: () => index.goal,
  useCompletedAutonomousGoal: () => index.completed,
  useAutonomousGoalWorkerTask: () => index.worker,
  stopAutonomousGoal: vi.fn(async () => {})
}))

import { WorktreeCardGoalBadge, WorktreeCardGoalRow } from './worktree-card-autonomous-goal'

const GOAL: AutonomousGoalListEntry = {
  id: 'goal_1',
  objective: 'Checkout with Pix',
  agent: 'claude',
  workerAgent: 'claude',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'p',
  worktreeId: 'wt-coord',
  runId: 'run_1',
  notes: [],
  rotations: 2,
  createdAt: 0,
  updatedAt: 0,
  progress: { tasksTotal: 3, tasksCompleted: 1, workers: [] }
}

function renderCard(worktreeId: string): void {
  render(
    <TooltipProvider>
      <WorktreeCardGoalBadge worktreeId={worktreeId} />
      <WorktreeCardGoalRow worktreeId={worktreeId} />
    </TooltipProvider>
  )
}

describe('worktree card goal views', () => {
  afterEach(() => {
    cleanup()
    index.goal = null
    index.completed = null
    index.worker = null
  })

  it('shows nothing on an ordinary worktree', () => {
    const { container } = render(
      <TooltipProvider>
        <WorktreeCardGoalBadge worktreeId="wt-plain" />
        <WorktreeCardGoalRow worktreeId="wt-plain" />
      </TooltipProvider>
    )
    expect(container.textContent).toBe('')
  })

  it('marks the coordinator and shows its progress with a stop control', () => {
    index.goal = GOAL
    renderCard('wt-coord')
    expect(screen.getByText('goal')).toBeTruthy()
    expect(screen.getByText('Working')).toBeTruthy()
    expect(screen.getByText('1 of 3 tasks')).toBeTruthy()
    expect(screen.getByText('Rotations: 2')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Goal progress' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop goal' })).toBeTruthy()
  })

  it('keeps the badge and status when an older host sends no progress', () => {
    index.goal = { ...GOAL, progress: undefined }
    renderCard('wt-coord')
    expect(screen.getByText('goal')).toBeTruthy()
    expect(screen.queryByText(/of 3 tasks/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('labels a worker with its Task number', () => {
    index.worker = { worktreeId: 'wt-worker', taskOrdinal: 2, taskStatus: 'dispatched' }
    renderCard('wt-worker')
    expect(screen.getByText('Task 2')).toBeTruthy()
    expect(screen.queryByText('goal')).toBeNull()
  })

  it('keeps a done badge, without progress, on a coordinator kept after its goal completed', () => {
    index.completed = { ...GOAL, status: 'complete', summary: 'Shipped Pix checkout' }
    renderCard('wt-coord')
    expect(screen.getByText('goal done')).toBeTruthy()
    expect(screen.queryByText('Working')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stop goal' })).toBeNull()
  })
})
