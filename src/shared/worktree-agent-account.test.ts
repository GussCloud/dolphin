import { describe, expect, it } from 'vitest'
import type { CodexManagedAccount, ClaudeManagedAccount } from './managed-account-types'
import {
  listWorktreeAgentAccountChoices,
  resolveWorktreeAgentAccount
} from './worktree-agent-account'

function codexAccount(overrides: Partial<CodexManagedAccount>): CodexManagedAccount {
  return {
    id: 'codex-a',
    email: 'a@example.test',
    managedHomePath: '/data/codex-accounts/codex-a/home',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0,
    ...overrides
  }
}

const claudeAccount: ClaudeManagedAccount = {
  id: 'claude-a',
  email: 'c@example.test',
  managedAuthPath: '/data/claude-accounts/claude-a',
  authMethod: 'subscription-oauth',
  createdAt: 0,
  updatedAt: 0,
  lastAuthenticatedAt: 0
}

const settings = {
  codexManagedAccounts: [
    codexAccount({}),
    codexAccount({
      id: 'codex-wsl',
      managedHomeRuntime: 'wsl',
      wslDistro: 'Ubuntu',
      managedHomePath: '\\\\wsl.localhost\\Ubuntu\\home\\u\\.dolphin-codex'
    })
  ],
  claudeManagedAccounts: [claudeAccount]
}

describe('resolveWorktreeAgentAccount', () => {
  it('keeps the global selection when the worktree pins nothing', () => {
    expect(
      resolveWorktreeAgentAccount({ agentAccountId: undefined, agent: 'codex', settings })
    ).toEqual({ kind: 'global' })
  })

  it('overrides with a pinned account that serves the target runtime', () => {
    expect(
      resolveWorktreeAgentAccount({
        agentAccountId: 'codex-a',
        agent: 'codex',
        target: { runtime: 'host' },
        settings
      })
    ).toEqual({ kind: 'override', accountId: 'codex-a' })
  })

  it('reports a removed account as unavailable instead of silently switching', () => {
    expect(
      resolveWorktreeAgentAccount({ agentAccountId: 'gone', agent: 'codex', settings })
    ).toEqual({ kind: 'unavailable', accountId: 'gone', reason: 'missing' })
  })

  it('reports an account from another runtime lane as unavailable', () => {
    expect(
      resolveWorktreeAgentAccount({
        agentAccountId: 'codex-wsl',
        agent: 'codex',
        target: { runtime: 'host' },
        settings
      })
    ).toEqual({ kind: 'unavailable', accountId: 'codex-wsl', reason: 'other-runtime' })
  })

  it('leaves another agent on the global selection when the pin belongs to a different agent', () => {
    expect(
      resolveWorktreeAgentAccount({ agentAccountId: 'claude-a', agent: 'codex', settings })
    ).toEqual({ kind: 'global' })
  })
})

describe('listWorktreeAgentAccountChoices', () => {
  it('lists only accounts of the target lane', () => {
    expect(
      listWorktreeAgentAccountChoices({ agent: 'codex', target: { runtime: 'host' }, settings })
    ).toEqual([{ id: 'codex-a', email: 'a@example.test', workspaceLabel: null }])
    expect(
      listWorktreeAgentAccountChoices({
        agent: 'codex',
        target: { runtime: 'wsl', wslDistro: 'ubuntu' },
        settings
      }).map((choice) => choice.id)
    ).toEqual(['codex-wsl'])
  })
})
