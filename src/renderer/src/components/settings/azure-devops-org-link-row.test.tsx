// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AzureDevOpsOrgLinkStatus } from '../../../../shared/azure-devops-org-link'
import { AzureDevOpsOrgLinkRow } from './azure-devops-org-link-row'

type StoreState = {
  settings: { activeRuntimeEnvironmentId: string | null }
  openSettingsTarget: (target: { pane: string; repoId: string | null }) => void
}

const mocks = vi.hoisted(() => {
  const store: { current: StoreState | null } = { current: null }
  return { store, orgLink: vi.fn() }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => {
    if (!mocks.store.current) {
      throw new Error('Store state was not installed')
    }
    return selector(mocks.store.current)
  }
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

function installStore(activeRuntimeEnvironmentId: string | null = null): StoreState {
  const state: StoreState = {
    settings: { activeRuntimeEnvironmentId },
    openSettingsTarget: vi.fn()
  }
  mocks.store.current = state
  return state
}

async function renderRow(link: AzureDevOpsOrgLinkStatus): Promise<HTMLDivElement> {
  mocks.orgLink.mockResolvedValue(link)
  Object.defineProperty(window, 'api', {
    value: { azureDevOps: { orgLink: mocks.orgLink } },
    configurable: true
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<AzureDevOpsOrgLinkRow />)
  })
  return container
}

function button(rendered: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(rendered.querySelectorAll('button')).find((b) => b.textContent === label)
}

describe('AzureDevOpsOrgLinkRow', () => {
  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    root = null
    container?.remove()
    container = null
    mocks.store.current = null
    mocks.orgLink.mockReset()
  })

  it.each<[AzureDevOpsOrgLinkStatus, string]>([
    [{ status: 'connected', organizationName: 'Contoso' }, 'Connected to organization Contoso'],
    [{ status: 'not-registered' }, "Your Azure DevOps organization isn't registered in Dolphin"],
    [
      { status: 'azure-devops-not-authenticated' },
      'Azure DevOps did not accept your sign-in, so your Dolphin organization could not be checked'
    ],
    [
      { status: 'azure-devops-not-authenticated', reason: 'public-org-scope' },
      'Your Azure DevOps token needs the Project and team (read) scope to connect to this organization'
    ],
    [{ status: 'unsupported-host' }, 'Azure DevOps Services (dev.azure.com) only'],
    [{ status: 'error', reason: 'boom' }, 'Could not check your Dolphin organization: boom']
  ])('shows %j', async (link, text) => {
    installStore()
    const rendered = await renderRow(link)
    expect(rendered.textContent).toContain(text)
    expect(mocks.orgLink).toHaveBeenCalledWith({ force: false })
  })

  it('re-checks with force from Check now', async () => {
    installStore()
    const rendered = await renderRow({ status: 'not-registered' })
    mocks.orgLink.mockResolvedValue({ status: 'connected', organizationName: 'Contoso' })
    await act(async () => {
      button(rendered, 'Check now')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mocks.orgLink).toHaveBeenLastCalledWith({ force: true })
    expect(rendered.textContent).toContain('Connected to organization Contoso')
  })

  it('offers the Dolphin account settings when signed out', async () => {
    const state = installStore()
    const rendered = await renderRow({ status: 'signed-out' })
    expect(rendered.textContent).toContain(
      'Sign in to your Dolphin account to connect to your organization'
    )
    await act(async () => {
      button(rendered, 'Open Dolphin account')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    expect(state.openSettingsTarget).toHaveBeenCalledWith({ pane: 'dolphin-account', repoId: null })
  })

  it('signs in with Azure DevOps from the signed-out row', async () => {
    installStore()
    const rendered = await renderRow({ status: 'signed-out' })
    expect(button(rendered, 'Open Dolphin account')).toBeDefined()
    mocks.orgLink.mockResolvedValue({ status: 'connected', organizationName: 'Contoso' })
    await act(async () => {
      button(rendered, 'Sign in with Azure DevOps')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    expect(mocks.orgLink).toHaveBeenLastCalledWith({ force: true, signIn: true })
    expect(rendered.textContent).toContain('Connected to organization Contoso')
    expect(button(rendered, 'Sign in with Azure DevOps')).toBeUndefined()
  })

  it('asks for a one-time sign-in when the email already has a Dolphin account', async () => {
    const state = installStore()
    const rendered = await renderRow({ status: 'account-exists' })
    expect(rendered.textContent).toContain(
      'A Dolphin account with this email already exists. Sign in once to link it.'
    )
    expect(button(rendered, 'Sign in with Azure DevOps')).toBeUndefined()
    await act(async () => {
      button(rendered, 'Open Dolphin account')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    expect(state.openSettingsTarget).toHaveBeenCalledWith({ pane: 'dolphin-account', repoId: null })
  })

  it('does not ask a remote host and hides Check now', async () => {
    installStore('runtime-1')
    const rendered = await renderRow({ status: 'connected', organizationName: 'Contoso' })
    expect(rendered.textContent).toContain('unavailable for remote hosts')
    expect(button(rendered, 'Check now')).toBeUndefined()
    expect(mocks.orgLink).not.toHaveBeenCalled()
  })
})
