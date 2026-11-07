import { describe, expect, it } from 'vitest'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { CodexManagedAccount } from '../../shared/managed-account-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { resolveCodexLaunchAccountOverride } from './worktree-codex-account-override'

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

function settings(activeHost: string | null): GlobalSettings {
  return {
    activeCodexManagedAccountId: activeHost,
    activeCodexManagedAccountIdsByRuntime: { host: activeHost, wsl: {} },
    codexManagedAccounts: [account('acct-active'), account('acct-pinned')],
    claudeManagedAccounts: []
  } as unknown as GlobalSettings
}

function source(metaById: Record<string, Partial<WorktreeMeta>>) {
  const all = metaById as Record<string, WorktreeMeta>
  return { getWorktreeMeta: (id: string) => all[id], getAllWorktreeMeta: () => all }
}

const PINNED_ID = 'repo-1::/repos/app-worktrees/feature'

describe('resolveCodexLaunchAccountOverride', () => {
  it('returns the pinned account for a launch in that worktree', () => {
    const result = resolveCodexLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-pinned' } }),
      settings: settings('acct-active'),
      target: { runtime: 'host' },
      worktreeId: PINNED_ID
    })
    expect(result).toMatchObject({ kind: 'override', account: { id: 'acct-pinned' } })
  })

  it('finds the worktree from a nested cwd when no id is threaded', () => {
    const result = resolveCodexLaunchAccountOverride({
      source: source({
        'repo-1::/repos/app': {},
        [PINNED_ID]: { agentAccountId: 'acct-pinned' }
      }),
      settings: settings('acct-active'),
      workspacePath: '/repos/app-worktrees/feature/src'
    })
    expect(result).toMatchObject({ kind: 'override', account: { id: 'acct-pinned' } })
  })

  it('does not match a sibling path that merely shares a prefix', () => {
    const result = resolveCodexLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-pinned' } }),
      settings: settings('acct-active'),
      workspacePath: '/repos/app-worktrees/feature-two'
    })
    expect(result).toEqual({ kind: 'none' })
  })

  it('keeps today’s behavior for worktrees without a pin', () => {
    const result = resolveCodexLaunchAccountOverride({
      source: source({ [PINNED_ID]: {} }),
      settings: settings('acct-active'),
      worktreeId: PINNED_ID
    })
    expect(result).toEqual({ kind: 'none' })
  })

  it('treats a pin equal to the active account as no override', () => {
    const result = resolveCodexLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-active' } }),
      settings: settings('acct-active'),
      worktreeId: PINNED_ID
    })
    expect(result).toEqual({ kind: 'none' })
  })

  it('reports a removed pinned account so the launch falls back visibly', () => {
    const result = resolveCodexLaunchAccountOverride({
      source: source({ [PINNED_ID]: { agentAccountId: 'acct-removed' } }),
      settings: settings('acct-active'),
      worktreeId: PINNED_ID
    })
    expect(result).toEqual({
      kind: 'unavailable',
      accountId: 'acct-removed',
      worktreeId: PINNED_ID,
      reason: 'missing'
    })
  })
})
