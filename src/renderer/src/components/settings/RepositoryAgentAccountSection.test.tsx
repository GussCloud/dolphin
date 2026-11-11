// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { ClaudeManagedAccount } from '../../../../shared/managed-account-types'

const storeState = vi.hoisted(() => {
  const claudeManagedAccounts: ClaudeManagedAccount[] = []
  return {
    settings: {
      claudeManagedAccounts,
      activeClaudeManagedAccountId: null,
      activeClaudeManagedAccountIdsByRuntime: { host: null, wsl: {} }
    }
  }
})

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))
vi.mock('./SearchableSetting', () => ({
  SearchableSetting: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))
// Why: Radix Select needs layout APIs happy-dom lacks; a native select keeps the value contract.
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

import { RepositoryAgentAccountSection } from './RepositoryAgentAccountSection'

const REPO: Repo = {
  id: 'r1',
  path: '/repos/work',
  displayName: 'work',
  badgeColor: '#000',
  addedAt: 0
}

function claude(id: string): ClaudeManagedAccount {
  return {
    id,
    email: `${id}@corp.example`,
    managedAuthPath: `/data/${id}`,
    authMethod: 'subscription-oauth',
    organizationUuid: null,
    organizationName: null,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  root = createRoot(container)
  storeState.settings.claudeManagedAccounts = [claude('company')]
})

afterEach(() => {
  act(() => root.unmount())
})

function select(): HTMLSelectElement {
  const element = container.querySelector('select')
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('expected the native select stand-in')
  }
  return element
}

describe('RepositoryAgentAccountSection', () => {
  it('saves the picked account and clears it back to the PC default', async () => {
    const updateRepo = vi.fn()
    await act(async () =>
      root.render(
        <RepositoryAgentAccountSection repo={REPO} agent="claude" updateRepo={updateRepo} />
      )
    )
    expect(select().options[0]?.textContent).toBe('System Claude login (this PC’s default)')

    await act(async () => {
      select().value = 'company'
      select().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(updateRepo).toHaveBeenLastCalledWith('r1', { claudeAccountId: 'company' })

    await act(async () =>
      root.render(
        <RepositoryAgentAccountSection
          agent="claude"
          repo={{ ...REPO, claudeAccountId: 'company' }}
          updateRepo={updateRepo}
        />
      )
    )
    await act(async () => {
      select().value = select().options[0]!.value
      select().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(updateRepo).toHaveBeenLastCalledWith('r1', { claudeAccountId: null })
  })

  it('keeps a removed account visible as unavailable instead of showing the default', async () => {
    await act(async () =>
      root.render(
        <RepositoryAgentAccountSection
          agent="claude"
          repo={{ ...REPO, claudeAccountId: 'removed' }}
          updateRepo={vi.fn()}
        />
      )
    )
    expect(select().value).toBe('removed')
    expect(select().selectedOptions[0]?.textContent).toBe('Unavailable account')
  })
})
