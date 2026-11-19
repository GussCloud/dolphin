// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { openModal, activateAndRevealWorktree, toastError } = vi.hoisted(() => ({
  openModal: vi.fn(),
  activateAndRevealWorktree: vi.fn((): unknown => ({ primaryTabId: null })),
  toastError: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({ settings: null }),
    { getState: () => ({ openModal }) }
  )
}))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorktree }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('./design-index', () => ({
  useDesignIndexSubscription: vi.fn(),
  useDesignIndex: () => ({ kind: 'ready', designs: [] })
}))
vi.mock('./design-agent-missing', () => ({ useDesignMinuteClock: () => 0 }))

import { TooltipProvider } from '@/components/ui/tooltip'
import DesignPage from './DesignPage'
import {
  DesignHostActionsContext,
  mainWindowDesignHostActions,
  popoutDesignHostActions,
  type DesignHostActions
} from './design-host-actions'
import { subscribeDesignPopoutCommands } from './design-popout-commands'
import { designRetryPrefill } from './design-agent-retry'
import { missingDesignRepoIds } from './design-popout-host-sync'

const designsApi = {
  openPopout: vi.fn(async () => undefined),
  getPopoutOpen: vi.fn(async () => false),
  onPopoutOpenChanged: vi.fn(() => () => undefined),
  openComposerInMain: vi.fn(async () => undefined),
  revealWorktreeInMain: vi.fn(async () => undefined)
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  Object.assign(window, { api: { designs: designsApi } })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

function renderPage(actions?: DesignHostActions): void {
  act(() =>
    root.render(
      <TooltipProvider>
        {actions ? (
          <DesignHostActionsContext.Provider value={actions}>
            <DesignPage />
          </DesignHostActionsContext.Provider>
        ) : (
          <DesignPage />
        )}
      </TooltipProvider>
    )
  )
}

function newDesignButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('New design')
  )
  if (!button) {
    throw new Error('New design button not found')
  }
  return button
}

describe('Design page header', () => {
  it('offers the pop-out in the main window and opens it on click', () => {
    renderPage()
    const button = container.querySelector<HTMLButtonElement>('[data-design-popout-button]')
    expect(button?.getAttribute('aria-label')).toBe('Open in new window')
    act(() => button?.click())
    expect(designsApi.openPopout).toHaveBeenCalledOnce()
  })

  it('opens the composer directly in the main window', () => {
    renderPage()
    act(() => newDesignButton().click())
    expect(openModal).toHaveBeenCalledWith('new-workspace-composer', { designMode: true })
    expect(designsApi.openComposerInMain).not.toHaveBeenCalled()
  })

  it('has no pop-out button inside the pop-out, and hands the composer to the main window', () => {
    renderPage(popoutDesignHostActions)
    expect(container.querySelector('[data-design-popout-button]')).toBeNull()
    act(() => newDesignButton().click())
    expect(designsApi.openComposerInMain).toHaveBeenCalledWith({})
    expect(openModal).not.toHaveBeenCalled()
  })
})

describe('Design host actions', () => {
  it('maps a retry prefill onto the composer modal data', () => {
    mainWindowDesignHostActions.openComposer(
      designRetryPrefill({ name: 'Checkout', request: 'Draw it', repoId: 'repo-1' })
    )
    expect(openModal).toHaveBeenCalledWith('new-workspace-composer', {
      designMode: true,
      prefilledName: 'Checkout',
      designRequest: 'Draw it',
      initialRepoId: 'repo-1'
    })
  })

  it('reveals the workspace on its environment and toasts when it is gone', () => {
    mainWindowDesignHostActions.revealWorktree('wt-1', 'env-1')
    expect(activateAndRevealWorktree).toHaveBeenCalledWith('wt-1', {
      executionHostId: expect.stringContaining('env-1')
    })
    expect(toastError).not.toHaveBeenCalled()

    activateAndRevealWorktree.mockReturnValueOnce(false)
    mainWindowDesignHostActions.revealWorktree('wt-2', null)
    expect(activateAndRevealWorktree).toHaveBeenLastCalledWith('wt-2', {})
    expect(toastError).toHaveBeenCalledOnce()
  })

  it('the pop-out sends both actions over IPC instead of running them', () => {
    popoutDesignHostActions.openComposer({ name: 'Checkout' })
    popoutDesignHostActions.revealWorktree('wt-1', null)
    expect(designsApi.openComposerInMain).toHaveBeenCalledWith({
      designPrefill: { name: 'Checkout' }
    })
    expect(designsApi.revealWorktreeInMain).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      runtimeEnvironmentId: null
    })
    expect(openModal).not.toHaveBeenCalled()
    expect(activateAndRevealWorktree).not.toHaveBeenCalled()
  })

  it('the main window runs what the pop-out handed over, until unsubscribed', () => {
    let composer: ((args: { designPrefill?: { name?: string } }) => void) | null = null
    let reveal:
      | ((args: { worktreeId: string; runtimeEnvironmentId?: string | null }) => void)
      | null = null
    const offComposer = vi.fn()
    const offReveal = vi.fn()
    const actions = { openComposer: vi.fn(), revealWorktree: vi.fn() }
    const stop = subscribeDesignPopoutCommands(
      {
        onOpenComposerRequested: (cb) => {
          composer = cb
          return offComposer
        },
        onRevealWorktreeRequested: (cb) => {
          reveal = cb
          return offReveal
        }
      },
      actions
    )
    composer!({ designPrefill: { name: 'Checkout' } })
    reveal!({ worktreeId: 'wt-1' })
    expect(actions.openComposer).toHaveBeenCalledWith({ name: 'Checkout' })
    expect(actions.revealWorktree).toHaveBeenCalledWith('wt-1', null)
    stop()
    expect(offComposer).toHaveBeenCalledOnce()
    expect(offReveal).toHaveBeenCalledOnce()
  })
})

describe('missingDesignRepoIds', () => {
  it('names each unknown project once, ignoring designs without one', () => {
    expect(
      missingDesignRepoIds(
        [{ repoId: 'b' }, { repoId: 'a' }, { repoId: 'b' }, { repoId: 'known' }, { repoId: null }],
        new Set(['known'])
      )
    ).toEqual(['a', 'b'])
  })
})
