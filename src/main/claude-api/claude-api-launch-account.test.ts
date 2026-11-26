import { describe, expect, it } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import {
  CLAUDE_API_ACCOUNT_GONE_MESSAGE,
  CLAUDE_API_NO_ACCOUNT_MESSAGE,
  CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE,
  CLAUDE_API_PINNED_ACCOUNT_GONE_MESSAGE,
  resolveClaudeApiLaunchAccount,
  type ClaudeApiLaunchAccountChoice,
  type ClaudeApiLaunchAccountSettings
} from './claude-api-launch-account'

function account(id: string, authMethod?: 'api-key'): ClaudeManagedAccount {
  const base: ClaudeManagedAccount = {
    id,
    email: authMethod ? '' : `${id}@example.com`,
    authMethod: 'subscription-oauth',
    managedAuthPath: `/managed/${id}`,
    managedAuthRuntime: 'host',
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
  return authMethod ? { ...base, authMethod } : base
}

const NONE: ClaudeApiLaunchAccountChoice = {
  resumeOwnerAccountId: null,
  paneAccountId: null,
  worktreePinAccountId: null
}
const PLAN = account('plan')
const API1 = account('api1', 'api-key')
const API2 = account('api2', 'api-key')
const API3 = account('api3', 'api-key')
const ALL: ClaudeApiLaunchAccountSettings = {
  claudeManagedAccounts: [PLAN, API1, API2, API3],
  codexManagedAccounts: [],
  claudeApiDefaultAccountId: 'api3'
}

function resolve(
  settings: ClaudeApiLaunchAccountSettings,
  choice: Partial<ClaudeApiLaunchAccountChoice> = {}
): string {
  return resolveClaudeApiLaunchAccount(settings, { ...NONE, ...choice }).id
}

describe('resolveClaudeApiLaunchAccount precedence', () => {
  it('1. the resumed session owner wins over everything else', () => {
    expect(
      resolve(ALL, {
        resumeOwnerAccountId: 'api1',
        paneAccountId: 'api2',
        worktreePinAccountId: 'api3'
      })
    ).toBe('api1')
  })

  it('2. the pane account wins over the pin and the default', () => {
    expect(resolve(ALL, { paneAccountId: 'api2', worktreePinAccountId: 'api1' })).toBe('api2')
  })

  it('3. the worktree pin wins over the default', () => {
    expect(resolve(ALL, { worktreePinAccountId: 'api1' })).toBe('api1')
  })

  it('4. the default applies when nothing else chooses', () => {
    expect(resolve(ALL)).toBe('api3')
  })

  it('5. the only API account applies without a default', () => {
    expect(resolve({ claudeManagedAccounts: [PLAN, API1] })).toBe('api1')
  })

  it('6. refuses to guess between several API accounts, or with none', () => {
    expect(() => resolve({ claudeManagedAccounts: [API1, API2] })).toThrow(
      CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE
    )
    expect(() => resolve({ claudeManagedAccounts: [PLAN] })).toThrow(CLAUDE_API_NO_ACCOUNT_MESSAGE)
  })
})

describe('resolveClaudeApiLaunchAccount never bills the plan', () => {
  it('skips a plan-account pin and falls to the default or the single API account', () => {
    expect(resolve(ALL, { worktreePinAccountId: 'plan' })).toBe('api3')
    expect(resolve({ claudeManagedAccounts: [PLAN, API1] }, { worktreePinAccountId: 'plan' })).toBe(
      'api1'
    )
  })

  it('refuses a plan-account pin when no API account exists', () => {
    expect(() =>
      resolve({ claudeManagedAccounts: [PLAN] }, { worktreePinAccountId: 'plan' })
    ).toThrow(CLAUDE_API_NO_ACCOUNT_MESSAGE)
  })

  it('refuses a plan account named by the pane or a resume', () => {
    expect(() => resolve(ALL, { paneAccountId: 'plan' })).toThrow(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
    expect(() => resolve(ALL, { resumeOwnerAccountId: 'plan' })).toThrow(
      CLAUDE_API_ACCOUNT_GONE_MESSAGE
    )
  })

  it('treats a default naming the plan account as unset', () => {
    expect(
      resolve({ claudeManagedAccounts: [PLAN, API1], claudeApiDefaultAccountId: 'plan' })
    ).toBe('api1')
  })
})

describe('resolveClaudeApiLaunchAccount stale choices', () => {
  it('refuses a pin naming no account and says how to recover', () => {
    expect(() => resolve(ALL, { worktreePinAccountId: 'gone' })).toThrow(
      CLAUDE_API_PINNED_ACCOUNT_GONE_MESSAGE
    )
    expect(CLAUDE_API_PINNED_ACCOUNT_GONE_MESSAGE).toMatch(/new workspace/)
  })

  it('refuses a pane account that is gone', () => {
    expect(() => resolve(ALL, { paneAccountId: 'gone' })).toThrow(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
  })

  it('treats a default naming a removed account as unset', () => {
    expect(
      resolve({ claudeManagedAccounts: [PLAN, API1], claudeApiDefaultAccountId: 'gone' })
    ).toBe('api1')
    expect(() =>
      resolve({ claudeManagedAccounts: [API1, API2], claudeApiDefaultAccountId: 'gone' })
    ).toThrow(CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE)
  })
})
