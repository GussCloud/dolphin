// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as I18n from '@/i18n/i18n'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string) => fallback
}))

import { NewWorkspaceComposerAutonomousSection } from './NewWorkspaceComposerAutonomousSection'
import { createAutonomousGoalDraft, type AutonomousGoalDraft } from '@/lib/autonomous-goal-draft'
import { AGENT_CATALOG } from '@/lib/agent-catalog'
import { isAutonomousGoalAgent } from '../../../../shared/autonomous-goal-types'

const GOAL_AGENTS = AGENT_CATALOG.filter((entry) => isAutonomousGoalAgent(entry.id))

function renderSection(overrides: Partial<AutonomousGoalDraft> = {}) {
  const onDraftChange = vi.fn()
  const draft = { ...createAutonomousGoalDraft('claude'), enabled: true, ...overrides }
  render(
    <NewWorkspaceComposerAutonomousSection
      draft={draft}
      onDraftChange={onDraftChange}
      coordinatorSupported
      workerAgents={GOAL_AGENTS}
    />
  )
  return { draft, onDraftChange }
}

describe('autonomous worktree cleanup options', () => {
  afterEach(() => cleanup())

  it('offers removal on, with the main worktree kept, by default', () => {
    renderSection()
    expect(
      screen
        .getByRole('switch', { name: 'Remove worktrees when done' })
        .getAttribute('aria-checked')
    ).toBe('true')
    expect(
      screen.getByRole('switch', { name: 'Keep main worktree' }).getAttribute('aria-checked')
    ).toBe('true')
  })

  it('hides the main worktree choice while removal is off', () => {
    renderSection({ removeWorktrees: false })
    expect(
      screen
        .getByRole('switch', { name: 'Remove worktrees when done' })
        .getAttribute('aria-checked')
    ).toBe('false')
    expect(screen.queryByRole('switch', { name: 'Keep main worktree' })).toBeNull()
  })

  it('writes each choice back into the draft', async () => {
    const { draft, onDraftChange } = renderSection()
    await userEvent.click(screen.getByRole('switch', { name: 'Keep main worktree' }))
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...draft, keepCoordinatorWorktree: false })
    await userEvent.click(screen.getByRole('switch', { name: 'Remove worktrees when done' }))
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...draft, removeWorktrees: false })
  })
})

describe('worker agent picker', () => {
  afterEach(() => cleanup())

  it('uses the agent combobox with icons, showing the chosen worker agent', () => {
    renderSection({ workerAgent: 'codex' })
    const pickers = screen
      .getAllByRole('combobox')
      .filter((element) => element.getAttribute('data-agent-combobox-root') === 'true')
    expect(pickers).toHaveLength(1)
    expect(pickers[0]!.textContent).toContain('Codex')
  })
})
