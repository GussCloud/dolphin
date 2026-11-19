// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ConfirmationDialogContext,
  type ConfirmationDialogOptions
} from '@/components/confirmation-dialog-context'
import type { Design, DesignStatus } from '../../../../shared/design-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DesignStatusControls } from './DesignStatusControls'

const setDesignStatus = vi.fn(async (_id: string, _status: DesignStatus) => {})
vi.mock('./design-index', () => ({
  setDesignStatus: (id: string, status: DesignStatus) => setDesignStatus(id, status)
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  setDesignStatus.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function design(status: DesignStatus, drawn = true): Design {
  return {
    id: 'd1',
    name: 'Sign-in',
    request: 'r',
    status,
    agent: 'claude',
    repoId: null,
    worktreeId: 'w1',
    paneKey: 'tab:1',
    canvasVersions: drawn ? [{ version: 2, at: 1, canvas: { groups: [], edges: [] } }] : [],
    events: [],
    decisions: [{ id: 'q', question: 'Which?', options: [], multiSelect: false, askedAt: 1 }],
    messages: [],
    inbox: [],
    delivery: { nudges: 0 },
    createdAt: 1,
    updatedAt: 1
  }
}

function render(status: DesignStatus, answer: boolean, drawn = true) {
  const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => answer)
  const onMoved = vi.fn(async () => {})
  act(() =>
    root.render(
      <ConfirmationDialogContext.Provider value={confirm}>
        <TooltipProvider>
          <DesignStatusControls design={design(status, drawn)} onMoved={onMoved} />
        </TooltipProvider>
      </ConfirmationDialogContext.Provider>
    )
  )
  return { confirm, onMoved }
}

async function click(to: DesignStatus): Promise<void> {
  const button = container.querySelector<HTMLButtonElement>(`[data-design-status-action="${to}"]`)
  if (!button) {
    throw new Error(`no action to ${to}`)
  }
  await act(async () => {
    button.click()
  })
}

describe('DesignStatusControls', () => {
  it('does not approve when the user cancels the confirmation', async () => {
    const { confirm } = render('draft', false)
    await click('in-progress')
    expect(confirm).toHaveBeenCalledOnce()
    expect(setDesignStatus).not.toHaveBeenCalled()
  })

  it('approves after the confirmation, which names the version and the open decision', async () => {
    const { confirm, onMoved } = render('draft', true)
    await click('in-progress')
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({
      description: expect.stringContaining('canvas version 2')
    })
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({
      description: expect.stringContaining('1 open decisions')
    })
    expect(setDesignStatus).toHaveBeenCalledWith('d1', 'in-progress')
    expect(onMoved).toHaveBeenCalledOnce()
  })

  it('keeps approval disabled before the first canvas', () => {
    render('draft', true, false)
    const approve = container.querySelector<HTMLButtonElement>(
      '[data-design-status-action="in-progress"]'
    )
    expect(approve?.disabled).toBe(true)
  })

  it('reopens directly', async () => {
    const { confirm } = render('discarded', true)
    await click('draft')
    expect(confirm).not.toHaveBeenCalled()
    expect(setDesignStatus).toHaveBeenCalledWith('d1', 'draft')
  })

  it('offers no bare finish button while in progress', () => {
    render('in-progress', true)
    expect(container.querySelector('[data-design-status-action="done"]')).toBeNull()
    expect(container.querySelector('[data-design-status-action="discarded"]')).not.toBeNull()
  })
})
