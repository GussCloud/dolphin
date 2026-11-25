import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { GlobalSettings } from '../../shared/global-settings-types'
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
  resetRuntimeAuthTestState,
  testState
} from './runtime-auth-service-test-harness'

vi.mock('electron', () => createElectronMock())
vi.mock('./oauth-refresh', () => createOauthRefreshMock())
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return { ...actual, homedir: () => testState.fakeHomeDir }
})
vi.mock('./keychain', () => createKeychainMock())

const WORKTREE_ID = 'repo-1::/repos/app-worktrees/feature'

function profileDir(accountId: string): string {
  return join(testState.userDataDir, 'claude-accounts', accountId, 'config')
}

// Why OAuth credentials on the API account too: the exclusion must hold on authMethod alone,
// not on the API account happening to have no login to materialize.
function setup(options: { active: string | null; pin?: string }) {
  const planPath = createManagedClaudeAuth(
    testState.userDataDir,
    'plan',
    createClaudeCredentialsJson('plan@example.test', 'plan')
  )
  const apiPath = createManagedClaudeAuth(
    testState.userDataDir,
    'api',
    createClaudeCredentialsJson('api@example.test', 'api')
  )
  const settings: GlobalSettings = createSettings({
    claudeManagedAccounts: [
      createClaudeAccount('plan', planPath, { email: 'plan@example.test' }),
      createClaudeAccount('api', apiPath, { email: '', label: 'Work API', authMethod: 'api-key' })
    ],
    activeClaudeManagedAccountId: options.active,
    activeClaudeManagedAccountIdsByRuntime: { host: options.active, wsl: {} }
  })
  const meta: Record<string, { agentAccountId?: string }> = {
    [WORKTREE_ID]: options.pin ? { agentAccountId: options.pin } : {}
  }
  return {
    ...createStore(settings),
    getWorktreeMeta: (id: string) => meta[id],
    getAllWorktreeMeta: () => meta
  }
}

async function newService(store: ReturnType<typeof setup>) {
  const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake store implements every Store method the auth service and the worktree resolver call.
  return new ClaudeRuntimeAuthService(store as never)
}

describe('ClaudeRuntimeAuthService never launches plain claude on an API account', () => {
  beforeEach(() => {
    resetRuntimeAuthTestState()
  })

  afterEach(() => {
    cleanupRuntimeAuthTestState()
  })

  it('treats an API account left as the active one as no account and clears it', async () => {
    const store = setup({ active: 'api' })
    const service = await newService(store)

    const preparation = await service.prepareForClaudeLaunch()

    expect(preparation.envPatch.CLAUDE_CONFIG_DIR).not.toBe(profileDir('api'))
    expect(preparation.provenance).toBe('system')
    expect(service.getRuntimeConfigDir()).not.toBe(profileDir('api'))
    expect(existsSync(join(profileDir('api'), '.credentials.json'))).toBe(false)
    expect(store.getSettings().activeClaudeManagedAccountIdsByRuntime?.host).toBeNull()
  })

  it('refuses a worktree pinned to an API account instead of falling back', async () => {
    const store = setup({ active: 'plan', pin: 'api' })
    const service = await newService(store)

    await expect(
      service.prepareForClaudeLaunch(undefined, { worktreeId: WORKTREE_ID })
    ).rejects.toThrow(/is an API account/)
    expect(existsSync(join(profileDir('api'), '.credentials.json'))).toBe(false)
  })

  it('refuses a structured session whose home is an API account profile', async () => {
    const store = setup({ active: 'plan' })
    const service = await newService(store)

    await expect(
      service.preparePinnedConfigDirForStructuredLaunch(profileDir('api'))
    ).rejects.toThrow(/no longer available/)
  })

  it('keeps launching the plan account while an API account exists', async () => {
    const store = setup({ active: 'plan' })
    const service = await newService(store)

    const preparation = await service.prepareForClaudeLaunch()

    expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: profileDir('plan') })
  })
})
