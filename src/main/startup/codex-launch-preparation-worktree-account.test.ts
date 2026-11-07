import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodexManagedAccount } from '../../shared/managed-account-types'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return { state, prepareRuntimeHooks: vi.fn(async () => ({ state: 'ok' })) }
})

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/dolphin-test' } }))
vi.mock('./main-process-state', () => ({ mainProcessState: mocks.state }))
vi.mock('../agent-trust-presets', () => ({ markCodexProjectTrusted: vi.fn(async () => {}) }))
vi.mock('../codex/hook-service', () => ({
  codexHookService: { prepareRuntimeHomeForLaunch: mocks.prepareRuntimeHooks }
}))
vi.mock('../wsl', () => ({ getDefaultWslDistro: () => 'Ubuntu' }))
vi.mock('../agent-hooks/managed-agent-hook-controls', () => ({
  isAgentStatusHooksEnabled: () => true
}))
vi.mock('../codex/codex-real-home-hook-install', () => ({
  ensureRealHomeCodexHookState: vi.fn(async () => {})
}))

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

const WORKTREE_ID = 'repo-1::/repos/app-worktrees/feature'

function install(agentAccountId: string | undefined) {
  const settings = {
    activeCodexManagedAccountId: 'acct-active',
    activeCodexManagedAccountIdsByRuntime: { host: 'acct-active', wsl: {} },
    codexManagedAccounts: [account('acct-active'), account('acct-pinned')],
    claudeManagedAccounts: []
  }
  const meta: Record<string, { agentAccountId?: string }> = {
    [WORKTREE_ID]: agentAccountId ? { agentAccountId } : {}
  }
  const runtimeHome = {
    isHostSystemDefaultRealHomeSelected: () => false,
    prepareForCodexLaunchAsync: vi.fn(async () => '/data/codex-accounts/acct-active/home'),
    prepareForCodexLaunchWithAccount: vi.fn((pinned: CodexManagedAccount) => pinned.managedHomePath)
  }
  mocks.state.codexRuntimeHome = runtimeHome
  mocks.state.store = {
    getSettings: () => settings,
    getWorktreeMeta: (id: string) => meta[id],
    getAllWorktreeMeta: () => meta
  }
  return runtimeHome
}

describe('prepareCodexRuntimeHomeForLaunch with a worktree-pinned account', () => {
  beforeEach(() => {
    mocks.prepareRuntimeHooks.mockClear()
  })

  it('pins CODEX_HOME to the worktree account and installs hooks there', async () => {
    const runtimeHome = install('acct-pinned')
    const { prepareCodexRuntimeHomeForLaunch } = await import('./codex-launch-preparation')

    const home = await prepareCodexRuntimeHomeForLaunch({ runtime: 'host' }, undefined, {
      worktreeId: WORKTREE_ID,
      launchAgent: 'codex'
    })

    expect(home).toBe('/data/codex-accounts/acct-pinned/home')
    expect(runtimeHome.prepareForCodexLaunchAsync).not.toHaveBeenCalled()
    expect(mocks.prepareRuntimeHooks).toHaveBeenCalledWith(
      '/data/codex-accounts/acct-pinned/home',
      { runtime: 'host' },
      true
    )
  })

  it('keeps the global selection when the worktree pins nothing', async () => {
    const runtimeHome = install(undefined)
    const { prepareCodexRuntimeHomeForLaunch } = await import('./codex-launch-preparation')

    const home = await prepareCodexRuntimeHomeForLaunch({ runtime: 'host' }, undefined, {
      worktreeId: WORKTREE_ID
    })

    expect(home).toBe('/data/codex-accounts/acct-active/home')
    expect(runtimeHome.prepareForCodexLaunchWithAccount).not.toHaveBeenCalled()
  })

  it('falls back to the global selection with a warning when the pinned account is gone', async () => {
    const runtimeHome = install('acct-removed')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { prepareCodexRuntimeHomeForLaunch } = await import('./codex-launch-preparation')

    const home = await prepareCodexRuntimeHomeForLaunch({ runtime: 'host' }, undefined, {
      worktreeId: WORKTREE_ID
    })

    expect(home).toBe('/data/codex-accounts/acct-active/home')
    expect(runtimeHome.prepareForCodexLaunchWithAccount).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unavailable account'))
    warn.mockRestore()
  })
})
