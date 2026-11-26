import { describe, expect, it } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import {
  CLAUDE_API_ACCOUNT_GONE_MESSAGE,
  CLAUDE_API_NO_ACCOUNT_MESSAGE,
  CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE,
  resolveClaudeApiLaunchAccount
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

const NONE = { resumeOwnerAccountId: null, paneAccountId: null, worktreePinAccountId: null }
const PLAN = account('plan')
const API1 = account('api1', 'api-key')
const API2 = account('api2', 'api-key')

describe('resolveClaudeApiLaunchAccount', () => {
  it('uses the only API account, never the plan account', () => {
    expect(resolveClaudeApiLaunchAccount({ claudeManagedAccounts: [PLAN, API1] }, NONE).id).toBe(
      'api1'
    )
  })

  it('refuses with no API account even when a plan account exists', () => {
    expect(() => resolveClaudeApiLaunchAccount({ claudeManagedAccounts: [PLAN] }, NONE)).toThrow(
      CLAUDE_API_NO_ACCOUNT_MESSAGE
    )
  })

  it('refuses to guess between several API accounts without a default', () => {
    expect(() =>
      resolveClaudeApiLaunchAccount({ claudeManagedAccounts: [API1, API2] }, NONE)
    ).toThrow(CLAUDE_API_NO_DEFAULT_ACCOUNT_MESSAGE)
  })

  it('takes the default, then a worktree pin over it, then the pane account over both', () => {
    const settings = {
      claudeManagedAccounts: [PLAN, API1, API2],
      claudeApiDefaultAccountId: 'api1'
    }
    expect(resolveClaudeApiLaunchAccount(settings, NONE).id).toBe('api1')
    expect(
      resolveClaudeApiLaunchAccount(settings, { ...NONE, worktreePinAccountId: 'api2' }).id
    ).toBe('api2')
    expect(
      resolveClaudeApiLaunchAccount(settings, {
        ...NONE,
        worktreePinAccountId: 'api2',
        paneAccountId: 'api1'
      }).id
    ).toBe('api1')
    expect(
      resolveClaudeApiLaunchAccount(settings, {
        ...NONE,
        paneAccountId: 'api1',
        resumeOwnerAccountId: 'api2'
      }).id
    ).toBe('api2')
  })

  it('ignores a pin of another agent and keeps the default', () => {
    const settings = {
      claudeManagedAccounts: [PLAN, API1],
      codexManagedAccounts: [],
      claudeApiDefaultAccountId: 'api1'
    }
    expect(
      resolveClaudeApiLaunchAccount(settings, { ...NONE, worktreePinAccountId: 'plan' }).id
    ).toBe('api1')
  })

  it.each([
    [{ ...NONE, paneAccountId: 'gone' }, {}],
    [{ ...NONE, paneAccountId: 'plan' }, {}],
    [{ ...NONE, worktreePinAccountId: 'gone' }, {}],
    [NONE, { claudeApiDefaultAccountId: 'gone' }]
  ])('refuses a chosen account that is gone instead of billing another (%#)', (choice, extra) => {
    expect(() =>
      resolveClaudeApiLaunchAccount({ claudeManagedAccounts: [PLAN, API1], ...extra }, choice)
    ).toThrow(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
  })
})
