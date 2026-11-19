// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DesignProcessingIndicator } from './DesignProcessingIndicator'
import type { DesignProcessingState } from './design-processing-state'

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

function render(state: DesignProcessingState, answering = true): HTMLElement | null {
  act(() => root.render(<DesignProcessingIndicator state={state} answering={answering} />))
  return container.querySelector<HTMLElement>('[data-design-processing]')
}

describe('DesignProcessingIndicator', () => {
  it('spins while processing and says whether it is the user’s reply', () => {
    const processing = render('processing')
    expect(processing?.textContent).toBe('The agent is processing your reply…')
    expect(processing?.querySelector('.animate-spin')).not.toBeNull()
    expect(render('processing', false)?.textContent).toBe('The agent is working…')
  })

  it('gives every other state its own text and nothing for idle', () => {
    const texts = (
      ['queued', 'notified', 'needs-permission', 'offline', 'unknown', 'replied'] as const
    ).map((state) => render(state)?.textContent)
    expect(new Set(texts).size).toBe(texts.length)
    expect(render('needs-permission')?.textContent).toContain('permission in the terminal')
    expect(render('offline')?.textContent).toContain("The agent's terminal is not connected")
    expect(render('idle')).toBeNull()
    expect(render('blocked')).toBeNull()
  })
})
