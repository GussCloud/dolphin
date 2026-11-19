// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignMessage } from '../../../../shared/design-types'
import { DesignThread } from './DesignThread'

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

const messages: DesignMessage[] = [
  { id: 'ask', author: 'user', text: 'Can this skip the code step?', blockId: 'b1', at: 1 },
  {
    id: 'reply',
    author: 'agent',
    text: 'Yes, for trusted devices.',
    blockId: 'b1',
    replyTo: 'ask',
    at: 2
  },
  { id: 'elsewhere', author: 'user', text: 'Other block', blockId: 'b2', at: 3 }
]

function type(value: string): void {
  const textarea = container.querySelector('textarea')
  if (!textarea) {
    throw new Error('composer not found')
  }
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      value
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function sendButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (entry) => entry.textContent?.trim() === 'Send'
  )
  if (!button) {
    throw new Error('send button not found')
  }
  return button
}

describe('DesignThread', () => {
  it('shows the inline processing line only while the agent works on this thread', () => {
    const render = (processing: boolean) =>
      act(() =>
        root.render(
          <DesignThread
            messages={messages}
            blockId="b1"
            placeholder="Ask"
            processing={processing}
            onSend={async () => {}}
          />
        )
      )
    render(false)
    expect(container.querySelector('[data-design-processing-inline]')).toBeNull()
    render(true)
    expect(container.querySelector('[data-design-processing-inline]')?.textContent).toBe(
      'Processing…'
    )
  })

  it("shows only the block's messages, with the agent reply nested", () => {
    act(() => {
      root.render(
        <DesignThread messages={messages} blockId="b1" placeholder="Ask" onSend={vi.fn()} />
      )
    })
    const rows = [...container.querySelectorAll('[data-design-message]')]
    expect(rows.map((row) => row.getAttribute('data-design-message'))).toEqual(['ask', 'reply'])
    expect(rows[1]?.className).toContain('ml-6')
    expect(container.textContent).not.toContain('Other block')
  })

  it('sends the trimmed text and clears the composer', async () => {
    const onSend = vi.fn(async () => {})
    act(() => {
      root.render(<DesignThread messages={[]} blockId="b1" placeholder="Ask" onSend={onSend} />)
    })
    type('  make it shorter  ')
    await act(async () => sendButton().click())
    expect(onSend).toHaveBeenCalledWith('make it shorter')
    expect(container.querySelector('textarea')?.value).toBe('')
  })

  it('keeps the text when sending fails', async () => {
    const onSend = vi.fn(async () => {
      throw new Error('offline')
    })
    act(() => {
      root.render(
        <DesignThread messages={[]} blockId={undefined} placeholder="Ask" onSend={onSend} />
      )
    })
    type('hello')
    await act(async () => {
      sendButton().click()
      await Promise.resolve()
    })
    expect(container.querySelector('textarea')?.value).toBe('hello')
  })
})
