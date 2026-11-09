import { describe, expect, it } from 'vitest'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import {
  DEFAULT_ACCOUNT_VALUE,
  azureDevOpsAccountOptions,
  githubAccountOptions,
  githubAccountValue,
  selectionFromValue,
  selectionValue
} from './project-account-options'
import {
  projectRemoteTargetFromIdentityKey,
  projectRemoteTargetFromUrl
} from './project-account-provider'

function account(overrides: Partial<GhAuthAccount>): GhAuthAccount {
  return {
    host: 'github.com',
    user: 'octo-one',
    active: false,
    envToken: null,
    source: 'keyring',
    scopes: [],
    ...overrides
  }
}

const inventory: GhAccountBindingInventory = {
  capability: 'supported',
  accounts: [
    account({ user: 'octo-one', active: true }),
    account({ user: 'octo-two' }),
    account({ user: 'env-user', source: 'env', envToken: 'GH_TOKEN' }),
    account({ host: 'git.example.test', user: 'enterprise-user' })
  ]
}

describe('projectRemoteTargetFromUrl', () => {
  it.each([
    ['https://github.com/acme/app.git', { provider: 'github', host: 'github.com' }],
    ['git@github.com:acme/app.git', { provider: 'github', host: 'github.com' }],
    ['ssh://git@ssh.github.com:443/acme/app.git', { provider: 'github', host: 'github.com' }],
    ['https://acme.ghe.com/acme/app', { provider: 'github', host: 'acme.ghe.com' }],
    [
      'https://dev.azure.com/org/proj/_git/app',
      { provider: 'azure-devops', host: 'dev.azure.com' }
    ],
    ['git@ssh.dev.azure.com:v3/org/proj/app', { provider: 'azure-devops', host: 'dev.azure.com' }],
    [
      'https://org.visualstudio.com/proj/_git/app',
      { provider: 'azure-devops', host: 'dev.azure.com' }
    ]
  ])('classifies %s', (url, expected) => {
    expect(projectRemoteTargetFromUrl(url)).toEqual(expected)
  })

  it('returns null for providers without account binding', () => {
    expect(projectRemoteTargetFromUrl('https://gitlab.com/acme/app.git')).toBeNull()
    expect(projectRemoteTargetFromUrl('https://bitbucket.org/acme/app.git')).toBeNull()
    expect(projectRemoteTargetFromUrl('')).toBeNull()
    expect(projectRemoteTargetFromUrl('not a url')).toBeNull()
  })

  it('treats an enterprise host as GitHub only when gh has a login for it', () => {
    const url = 'https://git.example.test/acme/app.git'
    expect(projectRemoteTargetFromUrl(url)).toBeNull()
    expect(projectRemoteTargetFromUrl(url, ['git.example.test'])).toEqual({
      provider: 'github',
      host: 'git.example.test'
    })
  })

  it('classifies a registered repo identity key', () => {
    expect(projectRemoteTargetFromIdentityKey('github.com/acme/app')).toEqual({
      provider: 'github',
      host: 'github.com'
    })
    expect(projectRemoteTargetFromIdentityKey(null)).toBeNull()
  })
})

describe('githubAccountOptions', () => {
  it('lists only logins on the remote host and disables env-token logins', () => {
    const options = githubAccountOptions(inventory, 'github.com')
    expect(options.map((option) => option.label)).toEqual([
      'octo-one',
      'octo-two',
      'env-user (GH_TOKEN)'
    ])
    expect(options.map((option) => option.disabled)).toEqual([false, false, true])
  })

  it('disables every login when the runtime cannot bind accounts', () => {
    const options = githubAccountOptions({ ...inventory, capability: 'unsupported' }, 'github.com')
    expect(options.every((option) => option.disabled)).toBe(true)
  })
})

describe('selection round-trip', () => {
  const context = { inventory, azureAccounts: [] }
  const githubTarget = { provider: 'github' as const, host: 'github.com' }

  it('maps the default option to a null binding, preserving the ambient login', () => {
    expect(selectionFromValue(DEFAULT_ACCOUNT_VALUE, githubTarget, context)).toEqual({
      provider: 'github',
      ghAccount: null
    })
    expect(selectionValue(null)).toBe(DEFAULT_ACCOUNT_VALUE)
    expect(selectionValue({ provider: 'github', ghAccount: null })).toBe(DEFAULT_ACCOUNT_VALUE)
  })

  it('maps a keyring login to its binding and refuses env-token or foreign-host values', () => {
    const value = githubAccountValue({ host: 'github.com', user: 'octo-two' })
    expect(selectionFromValue(value, githubTarget, context)).toEqual({
      provider: 'github',
      ghAccount: { host: 'github.com', user: 'octo-two' }
    })
    expect(
      selectionFromValue(
        githubAccountValue({ host: 'github.com', user: 'env-user' }),
        githubTarget,
        context
      )
    ).toBeNull()
    expect(
      selectionFromValue(
        githubAccountValue({ host: 'git.example.test', user: 'enterprise-user' }),
        githubTarget,
        context
      )
    ).toBeNull()
  })

  it('maps Azure DevOps managed accounts by id', () => {
    const azureAccounts = [
      { id: 'a1', login: 'dev@example.test', configDirName: 'a1', createdAt: 1 }
    ]
    const target = { provider: 'azure-devops' as const, host: 'dev.azure.com' }
    const [option] = azureDevOpsAccountOptions(azureAccounts)
    expect(option?.label).toBe('dev@example.test')
    expect(
      selectionFromValue(option?.value ?? '', target, { inventory: null, azureAccounts })
    ).toEqual({ provider: 'azure-devops', azureDevOpsAccountId: 'a1' })
    expect(
      selectionFromValue('ado\0missing', target, { inventory: null, azureAccounts })
    ).toBeNull()
  })
})
