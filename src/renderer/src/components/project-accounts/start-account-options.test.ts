import { describe, expect, it } from 'vitest'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import type { ClaudeManagedAccount } from '../../../../shared/managed-account-types'
import {
  claudePcDefaultEmail,
  claudeStartOptions,
  githubBindingFromValue,
  githubPcDefaultLogin,
  githubStartOptions
} from './start-account-options'

function gh(user: string, overrides: Partial<GhAuthAccount> = {}): GhAuthAccount {
  return {
    host: 'github.com',
    user,
    active: false,
    envToken: null,
    source: 'keyring',
    scopes: [],
    ...overrides
  }
}

function inventory(accounts: GhAuthAccount[]): GhAccountBindingInventory {
  return { accounts, capability: 'supported' }
}

function claude(id: string, overrides: Partial<ClaudeManagedAccount> = {}): ClaudeManagedAccount {
  return {
    id,
    email: `${id}@example.test`,
    managedAuthPath: `/data/${id}`,
    authMethod: 'subscription-oauth',
    organizationUuid: null,
    organizationName: null,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0,
    ...overrides
  }
}

describe('start account options', () => {
  const twoAccounts = inventory([
    gh('ana-personal', { active: true }),
    gh('ana-corp'),
    gh('ana', { host: 'ghe.corp.example', active: true })
  ])

  it('names the login gh uses today as the PC default, preferring github.com', () => {
    expect(githubPcDefaultLogin(twoAccounts)).toBe('ana-personal')
    expect(githubPcDefaultLogin(inventory([]))).toBeNull()
  })

  it('lists every host and tags GHES logins with their host', () => {
    const options = githubStartOptions(twoAccounts)
    expect(options.map((option) => option.label)).toEqual([
      'ana-personal',
      'ana-corp',
      'ana · ghe.corp.example'
    ])
    expect(githubBindingFromValue(twoAccounts, options[1]!.value)).toEqual({
      host: 'github.com',
      user: 'ana-corp'
    })
  })

  it('offers only host-runtime Claude accounts and names the active one as PC default', () => {
    const settings = {
      claudeManagedAccounts: [
        claude('corp', { organizationName: 'Corp' }),
        claude('wsl', { managedAuthRuntime: 'wsl', wslDistro: 'Ubuntu' })
      ],
      activeClaudeManagedAccountId: null,
      activeClaudeManagedAccountIdsByRuntime: { host: null, wsl: {} }
    }
    expect(claudeStartOptions(settings).map((option) => option.label)).toEqual([
      'corp@example.test · Corp'
    ])
    expect(claudePcDefaultEmail(settings)).toBeNull()
    expect(
      claudePcDefaultEmail({
        ...settings,
        activeClaudeManagedAccountIdsByRuntime: { host: 'corp', wsl: {} }
      })
    ).toBe('corp@example.test')
  })
})
