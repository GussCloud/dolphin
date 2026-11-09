// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import { GitHubAccountsList } from './github-accounts-list'

const { listGhMock, confirmMock, terminalProps } = vi.hoisted(() => {
  const terminal: { current: { command: string } | null } = { current: null }
  return { listGhMock: vi.fn(), confirmMock: vi.fn(), terminalProps: terminal }
})

vi.mock('@/store', () => {
  const state = { settings: { activeRuntimeEnvironmentId: null } }
  return { useAppStore: (selector: (s: typeof state) => unknown) => selector(state) }
})
vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' })
}))
vi.mock('../project-accounts/project-account-client', () => ({
  listGhHostAccounts: listGhMock
}))
vi.mock('@/components/confirmation-dialog-context', () => ({
  useConfirmationDialog: () => confirmMock
}))
vi.mock('@/components/onboarding/OnboardingInlineCommandTerminal', () => ({
  OnboardingInlineCommandTerminal: (props: { command: string }) => {
    terminalProps.current = props
    return <div data-testid="terminal">{props.command}</div>
  }
}))

function account(overrides: Partial<GhAuthAccount>): GhAuthAccount {
  return {
    host: 'github.com',
    user: 'work-login',
    active: false,
    envToken: null,
    source: 'keyring',
    scopes: [],
    ...overrides
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  terminalProps.current = null
  confirmMock.mockReset()
  listGhMock.mockReset().mockResolvedValue({
    capability: 'supported',
    accounts: [
      account({ user: 'work-login', active: true }),
      account({ user: 'env-login', source: 'env', envToken: 'GH_TOKEN' }),
      account({ host: 'ghe.example.test', user: 'enterprise-login' })
    ]
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render() {
  await act(async () => {
    root.render(<GitHubAccountsList onAccountsChanged={vi.fn()} />)
  })
  await act(async () => {})
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (entry) => entry.getAttribute('aria-label') === label || entry.textContent === label
  )
}

describe('GitHubAccountsList', () => {
  it('groups logins by host and offers removal only for keyring logins', async () => {
    await render()
    expect(container.textContent).toContain('github.com')
    expect(container.textContent).toContain('ghe.example.test')
    expect(button('Remove work-login on github.com')).toBeDefined()
    expect(button('Remove env-login on github.com')).toBeUndefined()
  })

  it('runs gh auth logout only after confirmation', async () => {
    await render()
    confirmMock.mockResolvedValueOnce(false)
    await act(async () => button('Remove work-login on github.com')!.click())
    expect(terminalProps.current).toBeNull()
    confirmMock.mockResolvedValueOnce(true)
    await act(async () => button('Remove work-login on github.com')!.click())
    expect(terminalProps.current?.command).toBe(
      'gh auth logout --hostname github.com --user work-login'
    )
  })

  it('starts a web login for the typed host and refuses shell syntax', async () => {
    await render()
    await act(async () => button('Add account')!.click())
    const input = container.querySelector<HTMLInputElement>('input[aria-label="GitHub host"]')!
    const setValue = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          input,
          value
        )
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await setValue('github.com; rm -rf ~')
    expect(button('Sign in')!.disabled).toBe(true)
    await setValue('ghe.example.test')
    await act(async () => button('Sign in')!.click())
    expect(terminalProps.current?.command).toBe('gh auth login --hostname ghe.example.test --web')
  })
})
