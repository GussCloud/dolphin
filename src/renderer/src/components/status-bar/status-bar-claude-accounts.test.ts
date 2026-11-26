import { describe, expect, it } from 'vitest'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import { buildClaudeStatusSwitchGroups } from './status-bar-claude-accounts'

describe('buildClaudeStatusSwitchGroups', () => {
  it('never offers an API account as the plain Claude account', () => {
    const base = { createdAt: 1, updatedAt: 1, lastAuthenticatedAt: 1 }
    const state: ClaudeRateLimitAccountsState = {
      accounts: [
        { id: 'plan', email: 'plan@example.test', authMethod: 'subscription-oauth', ...base },
        { id: 'api', email: '', label: 'Work API', authMethod: 'api-key', ...base }
      ],
      activeAccountId: 'plan',
      activeAccountIdsByRuntime: { host: 'plan', wsl: {} }
    }

    const [host] = buildClaudeStatusSwitchGroups(state, { runtime: 'host', wslDistro: null })

    expect(host.targets.map((target) => target.id)).toEqual([null, 'plan'])
  })
})
