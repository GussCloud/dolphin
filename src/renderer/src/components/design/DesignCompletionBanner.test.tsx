// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignCompletion } from '../../../../shared/design-types'
import { DesignCompletionBanner } from './DesignCompletionBanner'

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

const completion: DesignCompletion = {
  summary: 'Built the sign-in flow.\nTests: 12 passing.',
  at: 1,
  canvasVersion: 3
}

function action(name: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `[data-design-completion-action="${name}"]`
  )
  if (!button) {
    throw new Error(`${name} button not found`)
  }
  return button
}

function type(value: string): void {
  const textarea = container.querySelector('textarea')
  if (!textarea) {
    throw new Error('textarea not found')
  }
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      value
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click()
  })
}

function render(props: {
  onConfirm?: () => Promise<void>
  onDecline?: (text: string) => Promise<void>
}): void {
  act(() =>
    root.render(
      <DesignCompletionBanner
        completion={completion}
        onConfirm={props.onConfirm ?? (async () => {})}
        onDecline={props.onDecline ?? (async () => {})}
      />
    )
  )
}

describe('DesignCompletionBanner', () => {
  it('shows the summary with its line breaks and the implemented version', () => {
    render({})
    expect(container.textContent).toContain('Built the sign-in flow.\nTests: 12 passing.')
    expect(container.textContent).toContain('Version 3')
  })

  it('confirms through the caller', async () => {
    const onConfirm = vi.fn(async () => {})
    render({ onConfirm })
    await click(action('confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('sends what is left, trimmed, only once there is text', async () => {
    const onDecline = vi.fn(async (_text: string) => {})
    render({ onDecline })
    await click(action('decline'))
    expect(action('decline-send').disabled).toBe(true)
    type('  The error state is missing  ')
    await click(action('decline-send'))
    expect(onDecline).toHaveBeenCalledWith('The error state is missing')
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('keeps the text when the host refuses the decline', async () => {
    const onDecline = vi.fn(async (_text: string) => {
      throw new Error('refused')
    })
    render({ onDecline })
    await click(action('decline'))
    type('Still missing')
    await click(action('decline-send'))
    expect(container.querySelector('textarea')?.value).toBe('Still missing')
  })
})
