// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as I18n from '@/i18n/i18n'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('./use-local-only-goal-base', () => ({ useLocalOnlyGoalBase: () => false }))

import { useComposerGoalMode } from './composer-goal-mode'
import { createAutonomousGoalDraft } from '@/lib/autonomous-goal-draft'
import { createDesignDraft, type DesignDraft } from '@/lib/design-draft'
import { AGENT_CATALOG } from '@/lib/agent-catalog'
import type { TuiAgent } from '../../../../shared/tui-agent'

let lastNav: ReturnType<typeof useComposerGoalMode>['nav'] = null

function Harness(props: {
  draft: DesignDraft
  name: string
  quickAgent: TuiAgent | null
  targetUnavailable?: boolean
  onDraftChange: (next: DesignDraft) => void
  onQuickAgentChange: (agent: TuiAgent | null) => void
}) {
  const wizard = useComposerGoalMode(
    {
      // Why: the goal draft is still passed to prove the design draft wins over it.
      autonomousGoalDraft: createAutonomousGoalDraft('claude'),
      onAutonomousGoalDraftChange: vi.fn(),
      designDraft: props.draft,
      onDesignDraftChange: props.onDraftChange,
      orchestrationUnavailable: props.targetUnavailable,
      quickAgent: props.quickAgent,
      onQuickAgentChange: props.onQuickAgentChange,
      repoId: 'repo-1',
      baseBranch: undefined,
      name: props.name
    },
    AGENT_CATALOG
  )
  lastNav = wizard.nav
  return (
    <div>
      {wizard.stepper}
      <span data-testid="basics">{String(wizard.showBasics)}</span>
      <span data-testid="agent-section">{String(wizard.showAgentSection)}</span>
      <span data-testid="agents">{wizard.agents.map((entry) => entry.id).join(',')}</span>
      {wizard.beforeAgent}
    </div>
  )
}

function renderHarness(
  draft: Partial<DesignDraft>,
  options: { name?: string; agent?: TuiAgent | null; targetUnavailable?: boolean } = {}
) {
  const onDraftChange = vi.fn()
  const onQuickAgentChange = vi.fn()
  const fullDraft = { ...createDesignDraft(), ...draft }
  render(
    <Harness
      draft={fullDraft}
      name={options.name ?? 'Checkout'}
      quickAgent={options.agent === undefined ? 'claude' : options.agent}
      targetUnavailable={options.targetUnavailable}
      onDraftChange={onDraftChange}
      onQuickAgentChange={onQuickAgentChange}
    />
  )
  return { draft: fullDraft, onDraftChange, onQuickAgentChange }
}

describe('composer Design flow', () => {
  afterEach(() => {
    cleanup()
    lastNav = null
  })

  it('has two steps and no mode picker', () => {
    renderHarness({ step: 1 })
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1 Basics',
      '2 Request'
    ])
    expect(document.querySelector('[data-composer-mode-picker]')).toBeNull()
    expect(screen.getByTestId('basics').textContent).toBe('true')
    expect(screen.getByTestId('agent-section').textContent).toBe('false')
  })

  it('requires a name before leaving the basics', () => {
    renderHarness({ step: 1 }, { name: '   ' })
    expect(lastNav?.nextDisabled).toBe(true)
    cleanup()
    const { draft, onDraftChange } = renderHarness({ step: 1 })
    expect(lastNav?.nextDisabled).toBe(false)
    lastNav?.onNext?.()
    expect(onDraftChange).toHaveBeenCalledWith({ ...draft, step: 2 })
  })

  it('stays on the basics for a folder or multi-project target, and says why', () => {
    renderHarness({ step: 1 }, { targetUnavailable: true })
    expect(lastNav?.nextDisabled).toBe(true)
    expect(document.querySelector('[data-composer-design-unavailable]')).not.toBeNull()
  })

  it('moves a non-design agent to a design agent when advancing', () => {
    const { onQuickAgentChange } = renderHarness({ step: 1 }, { agent: 'gemini' })
    lastNav?.onNext?.()
    expect(onQuickAgentChange).toHaveBeenCalledWith('claude')
  })

  it('asks what to build and lists only design agents on step 2', async () => {
    const { draft, onDraftChange } = renderHarness({ step: 2 })
    expect(screen.getByTestId('agent-section').textContent).toBe('true')
    expect(screen.getByTestId('agents').textContent).not.toContain('gemini')
    expect(screen.getByTestId('agents').textContent).toContain('claude')
    expect(lastNav?.onNext).toBeUndefined()
    expect(lastNav?.onBack).toBeDefined()
    await userEvent.type(screen.getByLabelText('What are we building today?'), 'A')
    expect(onDraftChange).toHaveBeenLastCalledWith({ ...draft, request: 'A' })
  })
})
