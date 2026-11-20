// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignDecision } from '../../../../shared/design-types'
import { DesignDecisionCard } from './DesignDecisionCard'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const base: DesignDecision = {
  id: 'd1',
  question: 'How does the user sign in?',
  header: 'Login',
  options: [{ label: 'E-mail', description: 'Magic link' }, { label: 'Google' }, { label: 'SSO' }],
  multiSelect: false,
  blockId: 'b1',
  askedAt: 1
}

function render(
  decision: DesignDecision,
  onAnswer = vi.fn(async () => {}),
  onHoverChange = vi.fn()
): void {
  act(() => {
    root.render(
      <DesignDecisionCard
        key={decision.id}
        decision={decision}
        blockTitle="Login screen"
        onAnswer={onAnswer}
        onHoverChange={onHoverChange}
      />
    )
  })
}

function option(label: string): HTMLButtonElement {
  const row = [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(
    (button) => button.textContent?.includes(label)
  )
  if (!row) {
    throw new Error(`option not found: ${label}`)
  }
  return row
}

function answerButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (entry) => entry.textContent?.trim() === 'Answer'
  )
  if (!button) {
    throw new Error('answer button not found')
  }
  return button
}

function click(element: Element): void {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function typeNote(value: string): void {
  const textarea = container.querySelector('textarea')
  if (!textarea) {
    throw new Error('note not found')
  }
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      value
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('DesignDecisionCard', () => {
  it('sends the picked option label and the trimmed note', async () => {
    const onAnswer = vi.fn(async () => {})
    render(base, onAnswer)
    expect(answerButton().disabled).toBe(true)
    click(option('Google'))
    typeNote('  only for staff  ')
    await act(async () => answerButton().click())
    expect(onAnswer).toHaveBeenCalledWith({
      decisionId: 'd1',
      selected: ['Google'],
      note: 'only for staff'
    })
  })

  it('sends a written answer when no option fits', async () => {
    const onAnswer = vi.fn(async () => {})
    render(base, onAnswer)
    typeNote('   ')
    expect(answerButton().disabled).toBe(true)
    typeNote('  Passkey  ')
    expect(answerButton().disabled).toBe(false)
    await act(async () => answerButton().click())
    expect(onAnswer).toHaveBeenCalledWith({ decisionId: 'd1', selected: [], note: 'Passkey' })
  })

  it('keeps one choice on single-select and many on multi-select', async () => {
    const single = vi.fn(async () => {})
    render(base, single)
    click(option('E-mail'))
    click(option('SSO'))
    await act(async () => answerButton().click())
    expect(single).toHaveBeenCalledWith({ decisionId: 'd1', selected: ['SSO'] })

    const multi = vi.fn(async () => {})
    render({ ...base, id: 'd2', multiSelect: true }, multi)
    click(option('SSO'))
    click(option('E-mail'))
    await act(async () => answerButton().click())
    expect(multi).toHaveBeenCalledWith({ decisionId: 'd2', selected: ['E-mail', 'SSO'] })
  })

  it('shows an answered decision read-only with its choice', () => {
    render({ ...base, answer: { selected: ['Google'], note: 'staff', at: 5 } })
    expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(0)
    expect(container.textContent).toContain('Google')
    expect(container.textContent).toContain('staff')
    expect(container.textContent).toContain('Answered')
  })

  it('marks the original answer superseded and shows the later revision', () => {
    render({
      ...base,
      answer: { selected: ['Google'], at: 5 },
      revision: { text: 'Google and SSO', at: 9 }
    })
    expect(container.querySelector('[data-design-decision-superseded]')?.textContent).toBe('Google')
    const revision = container.querySelector('[data-design-decision-revision]')
    expect(revision?.textContent).toContain('Updated later')
    expect(revision?.textContent).toContain('Google and SSO')
    expect(container.textContent).toContain('Original answer')
  })

  it('shows no revision block on a decision that was never revised', () => {
    render({ ...base, answer: { selected: ['Google'], at: 5 } })
    expect(container.querySelector('[data-design-decision-revision]')).toBeNull()
    expect(container.querySelector('[data-design-decision-superseded]')).toBeNull()
  })

  it('reports the block it is about while hovered', () => {
    const onHoverChange = vi.fn()
    render(
      base,
      vi.fn(async () => {}),
      onHoverChange
    )
    const card = container.querySelector('[data-design-decision]')
    if (!card) {
      throw new Error('card not found')
    }
    act(() => card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    expect(onHoverChange).toHaveBeenCalledWith('b1')
  })
})
