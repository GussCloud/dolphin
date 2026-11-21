// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { NeedsYouRow } from './needs-you-rows'

const mocks = vi.hoisted(() => {
  const rows: NeedsYouRow[] = []
  return { rows, activateAgentPane: vi.fn() }
})

vi.mock('./useNeedsYouRows', () => ({
  useNeedsYouRows: () => mocks.rows
}))

vi.mock('./activate-agent-pane', () => ({
  activateAgentPane: mocks.activateAgentPane
}))

vi.mock('@/hooks/use-now', () => ({
  useNow: () => 1_000_000
}))

import NeedsYouSection from './NeedsYouSection'

const QUESTION_ROW: NeedsYouRow = {
  paneKey: 'tab1:11111111-1111-4111-8111-111111111111',
  tabId: 'tab1',
  worktreeId: 'w1',
  kind: 'waiting',
  stateStartedAt: 1_000_000 - 5 * 60_000,
  workspaceName: 'Checkout flow',
  projectName: 'shop',
  branch: 'feature/pay',
  promptText: 'Which database should I use?'
}

const PERMISSION_ROW: NeedsYouRow = {
  paneKey: 'tab2:22222222-2222-4222-8222-222222222222',
  tabId: 'tab2',
  worktreeId: 'folder:f1',
  kind: 'blocked',
  stateStartedAt: 1_000_000 - 2 * 3_600_000,
  workspaceName: 'Notes',
  projectName: 'Notes',
  branch: ''
}

let container: HTMLDivElement
let root: Root

function render(): void {
  act(() => {
    root.render(
      <TooltipProvider>
        <NeedsYouSection />
      </TooltipProvider>
    )
  })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.rows = []
  mocks.activateAgentPane.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('NeedsYouSection', () => {
  it('renders nothing when no agent needs the user', () => {
    render()
    expect(container.innerHTML).toBe('')
  })

  it('renders the header count, badges, prompt, age and repo · branch', () => {
    mocks.rows = [QUESTION_ROW, PERMISSION_ROW]
    render()
    const text = container.textContent ?? ''
    expect(container.querySelector('[data-needs-you-section]')).not.toBeNull()
    expect(text).toContain('Needs You')
    expect(text).toContain('2')
    expect(text).toContain('Checkout flow')
    expect(text).toContain('Needs input')
    expect(text).toContain('Which database should I use?')
    expect(text).toContain('5m')
    expect(text).toContain('shop · feature/pay')
    expect(text).toContain('Permission')
    expect(text).toContain('2h')
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    // No prompt text in the status: no body paragraph and no placeholder.
    expect(items[1].querySelector('p')).toBeNull()
    expect(items[1].textContent).not.toContain(' · ')
  })

  it('Reply focuses the agent pane through the shared activation', () => {
    mocks.rows = [QUESTION_ROW, PERMISSION_ROW]
    render()
    const buttons = [...container.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Reply'
    )
    expect(buttons).toHaveLength(2)
    act(() => buttons[1].click())
    expect(mocks.activateAgentPane).toHaveBeenCalledTimes(1)
    expect(mocks.activateAgentPane).toHaveBeenCalledWith(
      'folder:f1',
      'tab2',
      PERMISSION_ROW.paneKey
    )
  })
})
