// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AutonomousGoal } from '../../../../shared/autonomous-goal-types'
import { AutonomousGoalStrip } from './AutonomousGoalStrip'

const hook = vi.hoisted((): { goal: AutonomousGoal | null; stop: ReturnType<typeof vi.fn> } => ({
  goal: null,
  stop: vi.fn(async () => {})
}))

vi.mock('./use-worktree-autonomous-goal', () => ({
  useWorktreeAutonomousGoal: () => ({ goal: hook.goal, stop: hook.stop, refresh: async () => {} })
}))

afterEach(() => {
  cleanup()
  hook.goal = null
  hook.stop.mockClear()
})

const GOAL: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Read docs/ and build what it specifies',
  agent: 'claude',
  workerAgent: 'codex',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'pane-1',
  worktreeId: 'wt-1',
  runId: 'run_1',
  notes: [],
  rotations: 3,
  createdAt: 0,
  updatedAt: 0
}

function renderStrip(): void {
  render(
    <TooltipProvider>
      <AutonomousGoalStrip worktreeId="wt-1" />
    </TooltipProvider>
  )
}

describe('AutonomousGoalStrip', () => {
  it('renders nothing while the worktree drives no open goal', () => {
    renderStrip()
    expect(screen.queryByRole('button', { name: 'Stop goal' })).toBeNull()
  })

  it('shows status, objective and rotations, and stops the goal', () => {
    hook.goal = GOAL
    renderStrip()
    expect(screen.getByText('Working')).toBeInTheDocument()
    expect(screen.getByText(GOAL.objective)).toBeInTheDocument()
    expect(screen.getByText('Rotations: 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stop goal' }))
    expect(hook.stop).toHaveBeenCalledWith('goal_1')
  })

  it('puts an open blocker in place of the objective', () => {
    hook.goal = {
      ...GOAL,
      status: 'blocked',
      notes: [{ kind: 'blocker', text: 'Pick a database', at: 1 }]
    }
    renderStrip()
    expect(screen.getByText('Needs your decision')).toBeInTheDocument()
    expect(screen.getByText('Pick a database')).toBeInTheDocument()
  })
})
