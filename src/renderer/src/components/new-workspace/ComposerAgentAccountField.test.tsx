// @vitest-environment happy-dom

import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ClaudeManagedAccount,
  CodexManagedAccount
} from '../../../../shared/managed-account-types'

function claudeAccount(
  id: string,
  overrides: Partial<ClaudeManagedAccount> = {}
): ClaudeManagedAccount {
  return {
    id,
    email: `${id}@example.test`,
    managedAuthPath: `/data/claude-accounts/${id}/auth`,
    authMethod: 'subscription-oauth',
    organizationUuid: null,
    organizationName: null,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0,
    ...overrides
  }
}

function account(id: string): CodexManagedAccount {
  return {
    id,
    email: `${id}@example.test`,
    managedHomePath: `/data/codex-accounts/${id}/home`,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

type FakeSettings = {
  codexManagedAccounts: CodexManagedAccount[]
  claudeManagedAccounts: ClaudeManagedAccount[]
  activeRuntimeEnvironmentId: string | null
}

const storeState = vi.hoisted(() => {
  const settings: FakeSettings = {
    codexManagedAccounts: [],
    claudeManagedAccounts: [],
    activeRuntimeEnvironmentId: null
  }
  const repos: { id: string; path: string; agentAccountId?: string }[] = [
    { id: 'repo-1', path: '/repos/app' }
  ]
  return { settings, repos }
})

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))

// Why: Radix Select portals and pointer-captures; a native select exercises the same value contract.
vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
  } | null>(null)
  return {
    Select: ({
      value,
      onValueChange,
      children
    }: {
      value: string
      onValueChange: (value: string) => void
      children: React.ReactNode
    }) => {
      const context = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange])
      return <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
    },
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(SelectContext)!
      return (
        <select
          aria-label="account"
          value={context.value}
          onChange={(event) => context.onValueChange(event.target.value)}
        >
          {children}
        </select>
      )
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{React.Children.toArray(children).join(' ')}</option>
    )
  }
})

import { ComposerAgentAccountField } from './ComposerAgentAccountField'

function renderField(overrides: Partial<React.ComponentProps<typeof ComposerAgentAccountField>>) {
  const onValueChange = vi.fn()
  const view = render(
    <ComposerAgentAccountField
      agent="codex"
      repoId="repo-1"
      executionHostId="local"
      value={null}
      onValueChange={onValueChange}
      {...overrides}
    />
  )
  return { ...view, onValueChange }
}

afterEach(() => {
  cleanup()
  storeState.settings.codexManagedAccounts = []
  storeState.settings.claudeManagedAccounts = []
  storeState.settings.activeRuntimeEnvironmentId = null
})

describe('ComposerAgentAccountField', () => {
  it('offers the active account plus every managed Codex account of the local runtime', () => {
    storeState.settings.codexManagedAccounts = [account('acct-a'), account('acct-b')]
    const { getByLabelText, onValueChange } = renderField({})

    const select = getByLabelText('account')
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('expected the native select stand-in')
    }
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '__active-account__',
      'acct-a',
      'acct-b'
    ])
    expect(select.value).toBe('__active-account__')

    fireEvent.change(select, { target: { value: 'acct-b' } })
    expect(onValueChange).toHaveBeenLastCalledWith('acct-b')
    fireEvent.change(select, { target: { value: '__active-account__' } })
    expect(onValueChange).toHaveBeenLastCalledWith(null)
  })

  it.each([
    ['a Codex-less Claude lane', { agent: 'claude' as const }],
    ['DeepSeek, which never takes a managed account', { agent: 'deepseek' as const }],
    ['an SSH project', { executionHostId: 'ssh:box' }],
    ['no agent', { agent: null }]
  ])('stays hidden for %s', (_label, overrides) => {
    storeState.settings.codexManagedAccounts = [account('acct-a'), account('acct-b')]
    const { container } = renderField(overrides)
    expect(container.innerHTML).toBe('')
  })

  it('offers a single managed account next to the system login', () => {
    // Why: personal system login + one company account is the common two-account setup.
    storeState.settings.claudeManagedAccounts = [claudeAccount('claude-company')]
    const select = renderField({ agent: 'claude' }).getByLabelText('account')
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('expected the native select stand-in')
    }
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '__active-account__',
      'claude-company'
    ])
  })

  it("labels the unpinned choice with the project's default account", () => {
    storeState.settings.claudeManagedAccounts = [claudeAccount('claude-company')]
    storeState.repos[0].agentAccountId = 'claude-company'
    const select = renderField({ agent: 'claude' }).getByLabelText('account')
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('expected the native select stand-in')
    }
    expect(select.options[0]?.textContent).toBe('Project account ({{value0}})')
    delete storeState.repos[0].agentAccountId
  })

  it('stays hidden without a managed account or on a paired remote runtime', () => {
    expect(renderField({}).container.innerHTML).toBe('')
    cleanup()
    storeState.settings.codexManagedAccounts = [account('acct-a'), account('acct-b')]
    storeState.settings.activeRuntimeEnvironmentId = 'env-1'
    expect(renderField({}).container.innerHTML).toBe('')
  })

  it.each([['claude' as const], ['claude-agent-teams' as const]])(
    'offers the host Claude accounts for %s and leaves WSL ones out',
    (agent) => {
      storeState.settings.claudeManagedAccounts = [
        claudeAccount('claude-a'),
        claudeAccount('claude-b'),
        claudeAccount('claude-wsl', { managedAuthRuntime: 'wsl', wslDistro: 'Ubuntu' })
      ]
      const { getByLabelText, onValueChange } = renderField({ agent })

      const select = getByLabelText('account')
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error('expected the native select stand-in')
      }
      expect(Array.from(select.options).map((option) => option.value)).toEqual([
        '__active-account__',
        'claude-a',
        'claude-b'
      ])
      fireEvent.change(select, { target: { value: 'claude-b' } })
      expect(onValueChange).toHaveBeenLastCalledWith('claude-b')
    }
  )
})
