import { describe, expect, it } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { resolveClaudeLaunchAccountOverride } from './worktree-claude-account-override'

function account(id: string, overrides: Partial<ClaudeManagedAccount> = {}): ClaudeManagedAccount {
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

function settings(activeHost: string | null) {
  return {
    activeClaudeManagedAccountId: activeHost,
    activeClaudeManagedAccountIdsByRuntime: { host: activeHost, wsl: {} },
    claudeManagedAccounts: [
      account('acct-active'),
      account('acct-pinned'),
      account('acct-wsl', { managedAuthRuntime: 'wsl', wslDistro: 'Ubuntu' })
    ],
    codexManagedAccounts: []
  }
}

function source(metaById: Record<string, Pick<WorktreeMeta, 'agentAccountId'>>) {
  return { getWorktreeMeta: (id: string) => metaById[id], getAllWorktreeMeta: () => metaById }
}

const PINNED_ID = 'repo-1::/repos/app-worktrees/feature'

describe('resolveClaudeLaunchAccountOverride', () => {
  it('returns the pinned account for a launch in that worktree', () => {
    const result = resolveClaudeLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-pinned' } }),
      settings: settings('acct-active'),
      target: { runtime: 'host' },
      launch: { worktreeId: PINNED_ID }
    })
    expect(result).toMatchObject({ kind: 'override', account: { id: 'acct-pinned' } })
  })

  it('finds the worktree from a nested cwd when no id is threaded', () => {
    const result = resolveClaudeLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-pinned' } }),
      settings: settings('acct-active'),
      launch: { workspacePath: '/repos/app-worktrees/feature/src' }
    })
    expect(result).toMatchObject({ kind: 'override', account: { id: 'acct-pinned' } })
  })

  it('keeps the global selection when the pin equals the active account', () => {
    const result = resolveClaudeLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-pinned' } }),
      settings: settings('acct-pinned'),
      launch: { worktreeId: PINNED_ID }
    })
    expect(result).toEqual({ kind: 'none' })
  })

  it('keeps the global selection without a launch location', () => {
    const result = resolveClaudeLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-pinned' } }),
      settings: settings('acct-active'),
      launch: undefined
    })
    expect(result).toEqual({ kind: 'none' })
  })

  it('reports a pin on another runtime as unavailable', () => {
    const result = resolveClaudeLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-wsl' } }),
      settings: settings('acct-active'),
      target: { runtime: 'host' },
      launch: { worktreeId: PINNED_ID }
    })
    expect(result).toMatchObject({ kind: 'unavailable', reason: 'other-runtime' })
  })

  it('reports a deleted account as unavailable', () => {
    const result = resolveClaudeLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-gone' } }),
      settings: settings('acct-active'),
      launch: { worktreeId: PINNED_ID }
    })
    expect(result).toMatchObject({ kind: 'unavailable', reason: 'missing' })
  })
})
