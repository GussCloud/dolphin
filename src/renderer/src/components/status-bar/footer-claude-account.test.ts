import { describe, expect, it } from 'vitest'
import type { InactiveAccountUsage, ProviderRateLimits } from '../../../../shared/rate-limit-types'
import {
  projectAccountUsage,
  resolveFooterClaudeAccount,
  shouldFetchProjectAccountUsage
} from './footer-claude-account'

function account(id: string, email: string) {
  return {
    id,
    email,
    managedAuthPath: `/data/${id}`,
    authMethod: 'subscription-oauth' as const,
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
}

const settings = {
  claudeManagedAccounts: [account('personal', 'me@personal.test'), account('work', 'me@corp.test')],
  activeClaudeManagedAccountId: 'personal',
  activeClaudeManagedAccountIdsByRuntime: { host: 'personal', wsl: {} },
  activeRuntimeEnvironmentId: null
}

const limits = (session: number): ProviderRateLimits => ({
  provider: 'claude',
  session: { usedPercent: session, windowMinutes: 300, resetsAt: null, resetDescription: null },
  weekly: null,
  updatedAt: 10,
  error: null,
  status: 'ok'
})

describe('resolveFooterClaudeAccount', () => {
  it("follows the selected project's account, from its default or its workspace pin", () => {
    const fromProject = resolveFooterClaudeAccount({
      settings,
      worktree: { path: '/repos/app', agentAccountId: undefined },
      repo: { claudeAccountId: 'work', connectionId: null }
    })
    expect(fromProject).toEqual({ accountId: 'work', email: 'me@corp.test', fromProject: true })

    const pinned = resolveFooterClaudeAccount({
      settings,
      worktree: { path: '/repos/app-feature', agentAccountId: 'work' },
      repo: { claudeAccountId: undefined, connectionId: null }
    })
    expect(pinned.email).toBe('me@corp.test')
  })

  it('shows the active account for projects without one, SSH projects and remote servers', () => {
    const active = { accountId: 'personal', email: 'me@personal.test', fromProject: false }
    expect(resolveFooterClaudeAccount({ settings, worktree: null, repo: null })).toEqual(active)
    expect(
      resolveFooterClaudeAccount({
        settings,
        worktree: null,
        repo: { claudeAccountId: 'work', connectionId: 'ssh-1' }
      })
    ).toEqual(active)
    expect(
      resolveFooterClaudeAccount({
        settings: { ...settings, activeRuntimeEnvironmentId: 'server' },
        worktree: null,
        repo: { claudeAccountId: 'work', connectionId: null }
      })
    ).toEqual(active)
  })
})

describe('projectAccountUsage', () => {
  const work = { accountId: 'work', email: 'me@corp.test', fromProject: true }
  const inactive: InactiveAccountUsage[] = [
    { accountId: 'work', rateLimits: limits(70), updatedAt: 10, isFetching: false }
  ]

  it("uses the project account's usage instead of the active one", () => {
    expect(projectAccountUsage(limits(5), inactive, work)?.session?.usedPercent).toBe(70)
    expect(
      projectAccountUsage(limits(5), inactive, { ...work, fromProject: false })?.session
        ?.usedPercent
    ).toBe(5)
  })

  it('says unavailable rather than showing the wrong account when no usage exists yet', () => {
    expect(projectAccountUsage(limits(5), [], work)?.status).toBe('unavailable')
  })

  it('fetches only for a project account whose usage is missing or stale', () => {
    expect(shouldFetchProjectAccountUsage([], work, 100)).toBe(true)
    expect(shouldFetchProjectAccountUsage(inactive, work, 20)).toBe(false)
    expect(shouldFetchProjectAccountUsage(inactive, work, 10 + 6 * 60_000)).toBe(true)
    expect(shouldFetchProjectAccountUsage([], { ...work, fromProject: false }, 100)).toBe(false)
  })
})
