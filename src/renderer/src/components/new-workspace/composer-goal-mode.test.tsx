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
import {
  createAutonomousGoalDraft,
  type AutonomousGoalDraft,
  type ComposerWizardStep
} from '@/lib/autonomous-goal-draft'
import { AGENT_CATALOG } from '@/lib/agent-catalog'
import type { TuiAgent } from '../../../../shared/tui-agent'

let lastNav: ReturnType<typeof useComposerGoalMode>['nav'] = null

function Harness(props: {
  draft: AutonomousGoalDraft
  quickAgent: TuiAgent | null
  orchestrationUnavailable?: boolean
  onDraftChange: (next: AutonomousGoalDraft) => void
  onQuickAgentChange: (agent: TuiAgent | null) => void
}) {
  const wizard = useComposerGoalMode(
    {
      autonomousGoalDraft: props.draft,
      onAutonomousGoalDraftChange: props.onDraftChange,
      orchestrationUnavailable: props.orchestrationUnavailable,
      quickAgent: props.quickAgent,
      onQuickAgentChange: props.onQuickAgentChange,
      repoId: 'repo-1',
      baseBranch: 'feature/local'
    },
    AGENT_CATALOG
  )
  lastNav = wizard.nav
  return (
    <div>
      {wizard.stepper}
      <span data-testid="basics">{String(wizard.showBasics)}</span>
      <span data-testid="agent-section">{String(wizard.showAgentSection)}</span>
      <span data-testid="label">{wizard.agentLabel ?? 'Agent'}</span>
      <span data-testid="agents">{wizard.agents.map((entry) => entry.id).join(',')}</span>
      {wizard.beforeAgent}
      {wizard.goalSection}
      {wizard.afterAgent}
    </div>
  )
}

function renderHarness(
  overrides: Partial<AutonomousGoalDraft> & { step: ComposerWizardStep },
  quickAgent: TuiAgent | null = 'claude',
  orchestrationUnavailable = false
) {
  const onDraftChange = vi.fn()
  const onQuickAgentChange = vi.fn()
  const draft = { ...createAutonomousGoalDraft('claude'), ...overrides }
  render(
    <Harness
      draft={draft}
      quickAgent={quickAgent}
      orchestrationUnavailable={orchestrationUnavailable}
      onDraftChange={onDraftChange}
      onQuickAgentChange={onQuickAgentChange}
    />
  )
  return { draft, onDraftChange, onQuickAgentChange }
}

describe('composer steps', () => {
  afterEach(() => {
    cleanup()
    lastNav = null
    localOnlyGoalBase.value = false
  })

  it('opens on the shared basics and only advances from there', () => {
    const { draft, onDraftChange } = renderHarness({ step: 1 })
    expect(screen.getByTestId('basics').textContent).toBe('true')
    expect(screen.getByTestId('agent-section').textContent).toBe('false')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1 Basics',
      '2 Mode'
    ])
    expect(lastNav?.onBack).toBeUndefined()
    lastNav?.onNext?.()
    expect(onDraftChange).toHaveBeenCalledWith({ ...draft, step: 2 })
  })

  it('creates a plain worktree from step 2, with every agent', () => {
    renderHarness({ step: 2 }, 'gemini')
    expect(screen.getByRole('button', { name: /Worktree/ }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(screen.getByTestId('agent-section').textContent).toBe('true')
    expect(screen.getByTestId('agents').textContent).toContain('gemini')
    expect(lastNav?.onNext).toBeUndefined()
    expect(lastNav?.onBack).toBeDefined()
  })

  it('switches to Orchestration and moves a non-goal agent to the default coordinator', async () => {
    const { onDraftChange, onQuickAgentChange } = renderHarness({ step: 2 }, 'gemini')
    await userEvent.click(screen.getByRole('button', { name: /Orchestration/ }))
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, agentId: 'dolphin-orchestrator' })
    )
    expect(onQuickAgentChange).toHaveBeenCalledWith('claude')
  })

  it('shows four steps in Orchestration and keeps it disabled for a folder target', () => {
    renderHarness({ step: 2, enabled: true })
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(lastNav?.onNext).toBeDefined()
    cleanup()
    renderHarness({ step: 2 }, 'claude', true)
    expect(screen.getByRole('button', { name: /Orchestration/ }).hasAttribute('disabled')).toBe(
      true
    )
  })

  it('picks the orchestration agent with the coordinator and goal fields on step 3', () => {
    renderHarness({ step: 3, enabled: true })
    expect(screen.getByText('Orchestration agent')).toBeTruthy()
    expect(screen.getByTestId('label').textContent).toBe('Coordinator agent')
    expect(screen.getByTestId('agents').textContent).not.toContain('gemini')
    expect(screen.getByText('Goal')).toBeTruthy()
    expect(lastNav?.nextDisabled).toBe(true)
    cleanup()
    renderHarness({ step: 3, enabled: true, objective: 'Implement docs/' })
    expect(lastNav?.nextDisabled).toBe(false)
  })

  it('warns on step 3 when the picked base exists only locally', () => {
    localOnlyGoalBase.value = true
    renderHarness({ step: 3, enabled: true })
    expect(screen.getByRole('status').textContent).toContain('exists only on this machine')
  })

  it('asks for optional instructions on the last step, with an example', () => {
    renderHarness({ step: 4, enabled: true, objective: 'Ship' })
    expect(screen.getByLabelText('Additional instructions (optional)')).toBeTruthy()
    expect(
      screen.getByPlaceholderText('e.g. Do not run tests locally; leave validation to CI.')
    ).toBeTruthy()
    expect(lastNav?.onNext).toBeUndefined()
  })
})
