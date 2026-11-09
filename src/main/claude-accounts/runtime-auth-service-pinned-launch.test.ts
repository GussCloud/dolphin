import {
  cleanupRuntimeAuthTestState,
  createClaudeAccount,
  createClaudeCredentialsJson,
  createElectronMock,
  createKeychainMock,
  createManagedClaudeAuth,
  createOauthRefreshMock,
  createSettings,
  createStore,
  readManagedCredentialsForTest,
  resetRuntimeAuthTestState,
  setPlatform,
  testState
} from './runtime-auth-service-test-harness'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'

vi.mock('electron', () => createElectronMock())
vi.mock('./oauth-refresh', () => createOauthRefreshMock())
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return { ...actual, homedir: () => testState.fakeHomeDir }
})
vi.mock('./keychain', () => createKeychainMock())

const WORKTREE_ID = 'repo-1::/repos/app-worktrees/feature'

function pinnedDir(accountId: string): string {
  return join(testState.userDataDir, 'claude-accounts', accountId, 'config')
}

function rotated(email: string, token: string): string {
  return createClaudeCredentialsJson(email, token, null, Date.now() + 10 * 60_000)
}

function setup(options: { pin: string | null; active?: string } = { pin: 'pinned' }) {
  const activeCredentials = createClaudeCredentialsJson('active@example.test', 'active')
  const pinnedCredentials = createClaudeCredentialsJson('pinned@example.test', 'pinned')
  const activePath = createManagedClaudeAuth(
    testState.userDataDir,
    'active',
    activeCredentials,
    '{"accountUuid":"active","emailAddress":"active@example.test"}\n'
  )
  const pinnedPath = createManagedClaudeAuth(
    testState.userDataDir,
    'pinned',
    pinnedCredentials,
    '{"accountUuid":"pinned","emailAddress":"pinned@example.test"}\n'
  )
  const settings: GlobalSettings = createSettings({
    claudeManagedAccounts: [
      createClaudeAccount('active', activePath, { email: 'active@example.test' }),
      createClaudeAccount('pinned', pinnedPath, { email: 'pinned@example.test' })
    ],
    activeClaudeManagedAccountId: options.active ?? 'active'
  })
  const meta: Record<string, { agentAccountId?: string }> = {
    [WORKTREE_ID]: options.pin ? { agentAccountId: options.pin } : {}
  }
  const store = {
    ...createStore(settings),
    getWorktreeMeta: (id: string) => meta[id],
    getAllWorktreeMeta: () => meta
  }
  return { store, activeCredentials, pinnedCredentials, pinnedPath }
}

describe('ClaudeRuntimeAuthService pinned worktree launches', () => {
  beforeEach(() => {
    resetRuntimeAuthTestState()
  })

  afterEach(() => {
    cleanupRuntimeAuthTestState()
  })

  it('launches a pinned worktree on its own config dir without touching the global account', async () => {
    const { store, activeCredentials, pinnedCredentials } = setup()
    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    await service.syncForCurrentSelection()

    const preparation = await service.prepareForClaudeLaunch(undefined, {
      worktreeId: WORKTREE_ID
    })

    expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: pinnedDir('pinned') })
    expect(preparation.stripAuthEnv).toBe(true)
    expect(readFileSync(join(pinnedDir('pinned'), '.credentials.json'), 'utf-8')).toBe(
      pinnedCredentials
    )
    expect(testState.pinnedKeychainCredentials.get(pinnedDir('pinned'))).toBe(pinnedCredentials)
    expect(
      JSON.parse(readFileSync(join(pinnedDir('pinned'), '.claude.json'), 'utf-8'))
    ).toMatchObject({ hasCompletedOnboarding: true, oauthAccount: { accountUuid: 'pinned' } })
    // The global runtime still serves the active account.
    expect(readFileSync(join(testState.fakeHomeDir, '.claude', '.credentials.json'), 'utf-8')).toBe(
      activeCredentials
    )
    expect(testState.legacyKeychainCredentials).toBe(activeCredentials)
  })

  it('keeps the global launch when the worktree has no pin or pins the active account', async () => {
    for (const options of [{ pin: null }, { pin: 'pinned', active: 'pinned' }]) {
      resetRuntimeAuthTestState()
      const { store } = setup(options)
      const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
      const service = new ClaudeRuntimeAuthService(store as never)
      const preparation = await service.prepareForClaudeLaunch(undefined, {
        worktreeId: WORKTREE_ID
      })
      expect(preparation.envPatch).toEqual({})
      expect(existsSync(pinnedDir('pinned'))).toBe(false)
    }
  })

  it('reads a token the CLI rotated in the pinned dir back into the managed store', async () => {
    const { store, pinnedPath } = setup()
    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })
    const rotatedCredentials = rotated('pinned@example.test', 'pinned-rotated')
    testState.pinnedKeychainCredentials.set(pinnedDir('pinned'), rotatedCredentials)

    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })

    expect(readManagedCredentialsForTest('pinned', pinnedPath)).toBe(rotatedCredentials)
    expect(readFileSync(join(pinnedDir('pinned'), '.credentials.json'), 'utf-8')).toBe(
      rotatedCredentials
    )
  })

  it('refuses to adopt another identity logged in inside the pinned dir', async () => {
    const { store, pinnedPath, pinnedCredentials } = setup()
    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })
    testState.pinnedKeychainCredentials.set(
      pinnedDir('pinned'),
      rotated('someone-else@example.test', 'foreign')
    )

    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })

    expect(readManagedCredentialsForTest('pinned', pinnedPath)).toBe(pinnedCredentials)
    expect(testState.pinnedKeychainCredentials.get(pinnedDir('pinned'))).toBe(pinnedCredentials)
  })

  it('reads the pinned rotation back before making that account global', async () => {
    const { store, pinnedPath } = setup()
    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    await service.syncForCurrentSelection()
    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })
    const rotatedCredentials = rotated('pinned@example.test', 'pinned-rotated')
    testState.pinnedKeychainCredentials.set(pinnedDir('pinned'), rotatedCredentials)

    store.updateSettings({ activeClaudeManagedAccountId: 'pinned' })
    await service.syncForCurrentSelection()

    expect(readManagedCredentialsForTest('pinned', pinnedPath)).toBe(rotatedCredentials)
    expect(testState.legacyKeychainCredentials).toBe(rotatedCredentials)
  })

  it('materializes only the credentials file where Claude does not use the Keychain', async () => {
    setPlatform('linux')
    const { store, pinnedCredentials } = setup()
    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)

    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })

    expect(readFileSync(join(pinnedDir('pinned'), '.credentials.json'), 'utf-8')).toBe(
      pinnedCredentials
    )
    expect(testState.pinnedKeychainCredentials.size).toBe(0)
  })

  it('links the user instructions so the pinned launch keeps them', async () => {
    writeFileSync(join(testState.fakeHomeDir, '.claude', 'CLAUDE.md'), '# shared rules\n')
    const { store } = setup()
    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)

    await service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })

    expect(readFileSync(join(pinnedDir('pinned'), 'CLAUDE.md'), 'utf-8')).toBe('# shared rules\n')
  })
})
