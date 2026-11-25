import { describe, expect, it, vi } from 'vitest'
import type { ClaudeRateLimitAccountsState } from '../../shared/managed-account-types'
import { RuntimeAccountController } from './runtime-account-controller'

function claudeState(): ClaudeRateLimitAccountsState {
  const base = { createdAt: 1, updatedAt: 1, lastAuthenticatedAt: 1 }
  return {
    accounts: [
      { id: 'plan', email: 'plan@example.test', authMethod: 'subscription-oauth', ...base },
      { id: 'api', email: '', label: 'Work API', authMethod: 'api-key', ...base }
    ],
    activeAccountId: 'plan',
    activeAccountIdsByRuntime: { host: 'plan', wsl: {} }
  }
}

function controller(): RuntimeAccountController {
  const result = new RuntimeAccountController()
  const services = {
    claudeAccounts: {
      listAccounts: () => claudeState(),
      selectAccount: vi.fn(async () => claudeState()),
      removeAccount: vi.fn(async () => claudeState())
    },
    codexAccounts: {
      listAccounts: () => ({ accounts: [], activeAccountId: null })
    },
    rateLimits: {
      getState: () => ({
        claude: null,
        inactiveClaudeAccounts: [
          { accountId: 'other-plan', rateLimits: null, updatedAt: 1, isFetching: false },
          { accountId: 'api', rateLimits: null, updatedAt: 1, isFetching: false }
        ]
      })
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fakes implement every service member the controller calls here.
  result.setServices(services as never)
  return result
}

describe('RuntimeAccountController and Claude API accounts', () => {
  it('keeps API accounts out of what remote clients receive', async () => {
    const accounts = controller()

    const snapshot = accounts.getSnapshot()
    expect(snapshot.claude.accounts.map((account) => account.id)).toEqual(['plan'])
    expect(snapshot.rateLimits.inactiveClaudeAccounts.map((entry) => entry.accountId)).toEqual([
      'other-plan'
    ])
    expect((await accounts.selectClaude('plan')).accounts.map((account) => account.id)).toEqual([
      'plan'
    ])
    expect((await accounts.removeClaude('plan')).accounts.map((account) => account.id)).toEqual([
      'plan'
    ])
  })
})
