// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as I18n from '@/i18n/i18n'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string) => fallback
}))

const localOnlyGoalBase = vi.hoisted(() => ({ value: false }))
vi.mock('./use-local-only-goal-base', () => ({
  useLocalOnlyGoalBase: () => localOnlyGoalBase.value
}))

import { useComposerGoalMode } from './composer-goal-mode'
import { createAutonomousGoalDraft, type AutonomousGoalDraft } from '@/lib/autonomous-goal-draft'
import { AGENT_CATALOG } from '@/lib/agent-catalog'
import type { TuiAgent } from '../../../../shared/tui-agent'

function Harness(props: {
  draft: AutonomousGoalDraft
  quickAgent: TuiAgent | null
  onDraftChange: (next: AutonomousGoalDraft) => void
  onQuickAgentChange: (agent: TuiAgent | null) => void
}) {
  const mode = useComposerGoalMode(
    {
      autonomousGoalDraft: props.draft,
      onAutonomousGoalDraftChange: props.onDraftChange,
      quickAgent: props.quickAgent,
      onQuickAgentChange: props.onQuickAgentChange,
      repoId: 'repo-1',
      baseBranch: 'feature/local'
    },
    AGENT_CATALOG
  )
  return (
    <div>
      {mode.tabs}
      <span data-testid="label">{mode.agentLabel ?? 'Agent'}</span>
      <span data-testid="agents">{mode.agents.map((entry) => entry.id).join(',')}</span>
      {mode.goalSection}
    </div>
  )
}

function renderHarness(enabled: boolean, quickAgent: TuiAgent | null) {
  const onDraftChange = vi.fn()
  const onQuickAgentChange = vi.fn()
  const draft = { ...createAutonomousGoalDraft('claude'), enabled }
  render(
    <Harness
      draft={draft}
      quickAgent={quickAgent}
      onDraftChange={onDraftChange}
      onQuickAgentChange={onQuickAgentChange}
    />
  )
  return { draft, onDraftChange, onQuickAgentChange }
}

describe('composer goal mode tabs', () => {
  afterEach(() => {
    cleanup()
    localOnlyGoalBase.value = false
  })

  it('starts on the worktree tab with every agent and no goal fields', () => {
    renderHarness(false, 'gemini')
    expect(screen.getByRole('tab', { name: 'Worktree' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('label').textContent).toBe('Agent')
    expect(screen.getByTestId('agents').textContent).toContain('gemini')
    expect(screen.queryByText('Goal')).toBeNull()
  })

  it('switches to the goal tab and moves a non-goal agent to a coordinator', async () => {
    const { draft, onDraftChange, onQuickAgentChange } = renderHarness(false, 'gemini')
    await userEvent.click(screen.getByRole('tab', { name: 'Autonomous work' }))
    expect(onDraftChange).toHaveBeenCalledWith({ ...draft, enabled: true })
    expect(onQuickAgentChange).toHaveBeenCalledWith('claude')
  })

  it('offers only coordinator agents and the goal fields on the goal tab', () => {
    renderHarness(true, 'claude')
    expect(screen.getByTestId('label').textContent).toBe('Coordinator agent')
    expect(screen.getByTestId('agents').textContent).not.toContain('gemini')
    expect(screen.getByText('Goal')).toBeTruthy()
  })

  it('warns on the goal tab when the picked base exists only locally', () => {
    localOnlyGoalBase.value = true
    renderHarness(true, 'claude')
    expect(screen.getByRole('status').textContent).toContain('exists only on this machine')
  })

  it('shows no base warning when the base is on the remote', () => {
    renderHarness(true, 'claude')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
