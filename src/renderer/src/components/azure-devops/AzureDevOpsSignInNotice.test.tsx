// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AzureCliSignInState } from '../../../../shared/azure-devops-auth'
import { AzureDevOpsSignInNotice } from './AzureDevOpsSignInNotice'

const mocks = vi.hoisted(() => {
  const settings: { activeRuntimeEnvironmentId: string | null } = {
    activeRuntimeEnvironmentId: null
  }
  return { settings, toastError: vi.fn() }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { settings: typeof mocks.settings }) => unknown) =>
    selector({ settings: mocks.settings })
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: (props: { children?: React.ReactNode }) => props.children,
  TooltipTrigger: (props: { children?: React.ReactNode }) => props.children,
  TooltipContent: () => null
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: { open: boolean; children?: React.ReactNode }) => (
    <div data-menu-open={String(props.open)}>{props.children}</div>
  ),
  DropdownMenuTrigger: (props: { children?: React.ReactNode }) => props.children,
  DropdownMenuContent: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
  DropdownMenuItem: (props: { children?: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" data-menu-item onClick={() => props.onSelect?.()}>
      {props.children}
    </button>
  )
}))

type Listener = (state: AzureCliSignInState) => void

function installApi(initial: AzureCliSignInState) {
  let listener: Listener | null = null
  const api = {
    getCliSignInState: vi.fn().mockResolvedValue(initial),
    startCliSignIn: vi.fn().mockResolvedValue({ ok: true }),
    cancelCliSignIn: vi.fn().mockResolvedValue(undefined),
    onCliSignInStateChanged: vi.fn((cb: Listener) => {
      listener = cb
      return () => {
        listener = null
      }
    })
  }
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { azureDevOps: api }
  })
  return { api, emit: (state: AzureCliSignInState) => listener?.(state) }
}

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(): Promise<HTMLElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<AzureDevOpsSignInNotice floatingToggleShown />)
  })
  return container
}

function noticeButton(rendered: HTMLElement): HTMLButtonElement | null {
  return rendered.querySelector('[data-azure-devops-sign-in-notice] button')
}

function menuItems(rendered: HTMLElement): HTMLButtonElement[] {
  return [...rendered.querySelectorAll<HTMLButtonElement>('[data-menu-item]')]
}

describe('AzureDevOpsSignInNotice', () => {
  beforeEach(() => {
    mocks.settings.activeRuntimeEnvironmentId = null
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    root = null
    container?.remove()
    container = null
    mocks.toastError.mockReset()
    Reflect.deleteProperty(window, 'api')
  })

  it('renders nothing while the session is valid', async () => {
    installApi({ kind: 'idle' })
    const rendered = await render()
    expect(noticeButton(rendered)).toBeNull()
  })

  it('renders nothing when the client has no Azure DevOps desktop API', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: {} })
    const rendered = await render()
    expect(rendered.innerHTML).toBe('')
  })

  it('renders nothing on a remote runtime even when sign-in is required', async () => {
    mocks.settings.activeRuntimeEnvironmentId = 'env-1'
    installApi({ kind: 'required' })
    const rendered = await render()
    expect(noticeButton(rendered)).toBeNull()
  })

  it('appears when sign-in is required and signs in inside Dolphin on click', async () => {
    const { api } = installApi({ kind: 'required' })
    const rendered = await render()
    const button = noticeButton(rendered)
    expect(button?.getAttribute('aria-label')).toBe(
      'Azure DevOps sign-in expired. Click to sign in.'
    )
    await act(async () => button?.click())
    expect(api.startCliSignIn).toHaveBeenCalledWith('in-app')
  })

  it('follows pushed state changes and ignores clicks while signing in', async () => {
    const { api, emit } = installApi({ kind: 'idle' })
    const rendered = await render()
    expect(noticeButton(rendered)).toBeNull()
    await act(async () => emit({ kind: 'signing-in', mode: 'in-app' }))
    const button = noticeButton(rendered)
    expect(button?.getAttribute('aria-disabled')).toBe('true')
    await act(async () => button?.click())
    expect(api.startCliSignIn).not.toHaveBeenCalled()
  })

  it('offers the system browser from the context menu', async () => {
    const { api } = installApi({ kind: 'failed', error: 'AADSTS50058' })
    const rendered = await render()
    expect(noticeButton(rendered)?.getAttribute('aria-label')).toContain('AADSTS50058')
    const items = menuItems(rendered)
    expect(items.map((item) => item.textContent)).toEqual(['Open in system browser'])
    await act(async () => items[0]?.click())
    expect(api.startCliSignIn).toHaveBeenCalledWith('system-browser')
  })

  it('offers Cancel sign-in from the context menu while signing in', async () => {
    const { api } = installApi({ kind: 'signing-in', mode: 'system-browser' })
    const rendered = await render()
    const items = menuItems(rendered)
    expect(items.map((item) => item.textContent)).toEqual(['Cancel sign-in'])
    await act(async () => items[0]?.click())
    expect(api.cancelCliSignIn).toHaveBeenCalled()
  })

  it('opens the menu on right-click', async () => {
    installApi({ kind: 'required' })
    const rendered = await render()
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    await act(async () => {
      noticeButton(rendered)?.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      )
    })
    expect(rendered.querySelector('[data-menu-open]')?.getAttribute('data-menu-open')).toBe('true')
    frame.mockRestore()
  })

  it('toasts a failed sign-in but not a cancelled one', async () => {
    const { api } = installApi({ kind: 'required' })
    const rendered = await render()
    api.startCliSignIn.mockResolvedValueOnce({ ok: false, error: 'cancelled' })
    await act(async () => noticeButton(rendered)?.click())
    expect(mocks.toastError).not.toHaveBeenCalled()
    api.startCliSignIn.mockResolvedValueOnce({ ok: false, error: 'timed out' })
    await act(async () => noticeButton(rendered)?.click())
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Azure DevOps sign-in failed: timed out',
      expect.objectContaining({ description: expect.stringContaining('Open in system browser') })
    )
  })
})
