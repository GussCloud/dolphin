// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ConfirmationDialogContext,
  type ConfirmationDialogOptions
} from '@/components/confirmation-dialog-context'
import type { Design, DesignAgentStatus, DesignStatus } from '../../../../shared/design-types'
import type { DesignProcessingState } from './design-processing-state'
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

function render(
  status: DesignStatus,
  answer: boolean,
  drawn = true,
  agent: { agentStatus?: DesignAgentStatus | null; processing?: DesignProcessingState } = {}
) {
  const confirm = vi.fn(async (_options: ConfirmationDialogOptions) => answer)
  const onMoved = vi.fn(async () => {})
  act(() =>
    root.render(
      <ConfirmationDialogContext.Provider value={confirm}>
        <TooltipProvider>
          <DesignStatusControls
            design={design(status, drawn)}
            agentStatus={agent.agentStatus ?? { live: true, status: 'idle' }}
            processing={agent.processing ?? 'idle'}
            onMoved={onMoved}
          />
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

  it.each(['queued', 'notified', 'processing', 'needs-permission'] as const)(
    'keeps approval disabled while the agent is %s, with the reason in a tooltip wrapper',
    (processing) => {
      render('draft', true, true, { processing })
      const approve = container.querySelector<HTMLButtonElement>(
        '[data-design-status-action="in-progress"]'
      )
      expect(approve?.disabled).toBe(true)
      expect(approve?.parentElement?.tabIndex).toBe(0)
      expect(
        container.querySelector<HTMLButtonElement>('[data-design-status-action="discarded"]')
          ?.disabled
      ).toBe(false)
    }
  )

  it.each(['unknown', 'offline', 'replied'] as const)(
    'lets the user approve when the agent is %s',
    async (processing) => {
      const { confirm } = render('draft', true, true, { processing })
      await click('in-progress')
      expect(confirm).toHaveBeenCalledOnce()
      expect(setDesignStatus).toHaveBeenCalledWith('d1', 'in-progress')
    }
  )

  it('discards without a confirmation when the bound pane is no longer live', async () => {
    const { confirm } = render('draft', true, true, {
      agentStatus: { live: false, status: null }
    })
    await click('discarded')
    expect(confirm).not.toHaveBeenCalled()
    expect(setDesignStatus).toHaveBeenCalledWith('d1', 'discarded')
  })

  it('confirms a discard when liveness cannot be read but a pane is bound', async () => {
    const { confirm } = render('draft', false, true, { agentStatus: null })
    await click('discarded')
    expect(confirm).toHaveBeenCalledOnce()
    expect(setDesignStatus).not.toHaveBeenCalled()
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
