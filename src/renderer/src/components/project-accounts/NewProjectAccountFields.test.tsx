// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import { NewProjectAccountFields } from './NewProjectAccountFields'
import {
  EMPTY_NEW_PROJECT_ACCOUNT_DRAFT,
  resolveNewProjectAccountSettings,
  type NewProjectAccountDraft
} from './new-project-account-settings'
import { DEFAULT_ACCOUNT_VALUE } from './project-account-options'

const { listGhMock, listAzureMock } = vi.hoisted(() => ({
  listGhMock: vi.fn(),
  listAzureMock: vi.fn()
}))

vi.mock('./project-account-client', () => ({
  listGhHostAccounts: listGhMock,
  listAzureDevOpsManagedAccounts: listAzureMock
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' })
}))

// Why: Radix Select needs layout APIs happy-dom lacks; a native select keeps value + disabled testable.
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.currentTarget.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    disabled,
    children
  }: {
    value: string
    disabled?: boolean
    children: React.ReactNode
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  )
}))

function ghAccount(host: string, user: string): GhAuthAccount {
  return { host, user, active: false, envToken: null, source: 'keyring', scopes: [] }
}

const INVENTORY: GhAccountBindingInventory = {
  capability: 'supported',
  accounts: [
    ghAccount('github.com', 'work-login'),
    ghAccount('github.com', 'personal-login'),
    ghAccount('git.example.test', 'enterprise-login')
  ]
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  listGhMock.mockReset().mockResolvedValue(INVENTORY)
  listAzureMock
    .mockReset()
    .mockResolvedValue([
      { id: 'ado-1', login: 'dev@example.test', configDirName: 'ado-1', createdAt: 1 }
    ])
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(
  remoteUrl: string,
  draft: NewProjectAccountDraft = EMPTY_NEW_PROJECT_ACCOUNT_DRAFT,
  wslDistro: string | null = null
) {
  const onSelectionChange = vi.fn()
  const onIdentityChange = vi.fn()
  await act(async () => {
    root.render(
      <NewProjectAccountFields
        remoteUrl={remoteUrl}
        runtimeEnvironmentId={null}
        wslDistro={wslDistro}
        draft={draft}
        onSelectionChange={onSelectionChange}
        onIdentityChange={onIdentityChange}
      />
    )
  })
  await act(async () => {})
  return { onSelectionChange, onIdentityChange }
}

// The account picker renders first; the commit author picker is the last select.
function optionLabels(select = container.querySelector('select')): string[] {
  return Array.from(select?.querySelectorAll('option') ?? []).map(
    (option) => option.textContent ?? ''
  )
}

describe('NewProjectAccountFields', () => {
  it('offers only GitHub logins on the clone URL host, defaulting to the ambient login', async () => {
    await render('https://github.com/acme/app.git')
    expect(optionLabels()).toEqual([
      'Default account (gh’s active login)',
      'work-login',
      'personal-login'
    ])
    expect(container.querySelector('select')?.value).toBe(DEFAULT_ACCOUNT_VALUE)
  })

  it('recognizes an enterprise host through the gh inventory', async () => {
    await render('https://git.example.test/acme/app.git')
    expect(optionLabels()).toEqual(['Default account (gh’s active login)', 'enterprise-login'])
  })

  it('offers Azure DevOps managed accounts for Azure Repos URLs', async () => {
    await render('https://dev.azure.com/org/proj/_git/app')
    expect(optionLabels()).toEqual(['Default sign-in', 'dev@example.test'])
  })

  it('shows no account picker for providers without binding support', async () => {
    await render('https://gitlab.com/acme/app.git')
    // Only the commit author picker remains.
    const selects = container.querySelectorAll('select')
    expect(selects).toHaveLength(1)
    expect(optionLabels(selects[0])).toEqual(['Git config identity (default)'])
  })

  it('reports the picked login as a binding', async () => {
    const { onSelectionChange } = await render('https://github.com/acme/app.git')
    const select = container.querySelector('select')!
    await act(async () => {
      select.value = Array.from(select.options).find(
        (o) => o.textContent === 'personal-login'
      )!.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onSelectionChange).toHaveBeenCalledWith({
      provider: 'github',
      ghAccount: { host: 'github.com', user: 'personal-login' }
    })
  })

  it('drops a binding when the URL moves to another provider', async () => {
    const { onSelectionChange } = await render('https://gitlab.com/acme/app.git', {
      ...EMPTY_NEW_PROJECT_ACCOUNT_DRAFT,
      selection: { provider: 'github', ghAccount: { host: 'github.com', user: 'work-login' } }
    })
    expect(onSelectionChange).toHaveBeenCalledWith(null)
  })
})

describe('NewProjectAccountFields on WSL', () => {
  it('lists the destination distro gh logins', async () => {
    await render('https://github.com/acme/app.git', EMPTY_NEW_PROJECT_ACCOUNT_DRAFT, 'Ubuntu')
    expect(listGhMock).toHaveBeenCalledWith(
      { kind: 'local' },
      {
        refreshCapability: false,
        wslDistro: 'Ubuntu'
      }
    )
  })

  it('shows a rejected listing instead of an empty account list', async () => {
    listGhMock.mockRejectedValue(new Error('Invalid WSL distro name: bad name'))
    await render('https://github.com/acme/app.git', EMPTY_NEW_PROJECT_ACCOUNT_DRAFT, 'bad name')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Invalid WSL distro name: bad name'
    )
  })
})

describe('resolveNewProjectAccountSettings', () => {
  it('returns no fields for the defaults, so the add flow is unchanged', () => {
    expect(resolveNewProjectAccountSettings(EMPTY_NEW_PROJECT_ACCOUNT_DRAFT)).toEqual({})
  })

  it('blocks a half-filled commit author', () => {
    expect(
      resolveNewProjectAccountSettings({
        selection: null,
        identity: { name: 'Dev', email: '' }
      })
    ).toBeNull()
  })

  it('carries the binding and the author', () => {
    expect(
      resolveNewProjectAccountSettings({
        selection: { provider: 'azure-devops', azureDevOpsAccountId: 'ado-1' },
        identity: { name: 'Dev', email: 'dev@example.test' }
      })
    ).toEqual({
      azureDevOpsAccountId: 'ado-1',
      commitIdentity: { name: 'Dev', email: 'dev@example.test' }
    })
  })
})
