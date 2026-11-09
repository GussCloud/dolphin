import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSettings } from './runtime-home-settings-test-fixtures'
import {
  createManagedAuth,
  createStore,
  setupRuntimeHomeTest,
  teardownRuntimeHomeTest,
  testState
} from './runtime-home-service-test-harness'
import type { CodexManagedAccount } from '../../shared/managed-account-types'

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.userDataDir
  }
}))

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return {
    ...actual,
    homedir: () => testState.fakeHomeDir
  }
})

function account(id: string, managedHomePath: string): CodexManagedAccount {
  return {
    id,
    email: `${id}@example.test`,
    managedHomePath,
    providerAccountId: null,
    workspaceLabel: null,
    workspaceAccountId: null,
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
}

describe('CodexRuntimeHomeService.prepareForCodexLaunchWithAccount', () => {
  beforeEach(() => {
    setupRuntimeHomeTest()
  })

  afterEach(() => {
    teardownRuntimeHomeTest()
  })

  it('returns the pinned account home without touching the global selection', async () => {
    const activeHome = createManagedAuth(testState.userDataDir, 'acct-active', '{"a":1}\n')
    const pinnedHome = createManagedAuth(testState.userDataDir, 'acct-pinned', '{"p":1}\n')
    const store = createStore(
      createSettings({
        codexManagedAccounts: [
          account('acct-active', activeHome),
          account('acct-pinned', pinnedHome)
        ],
        activeCodexManagedAccountId: 'acct-active',
        activeCodexManagedAccountIdsByRuntime: { host: 'acct-active', wsl: {} }
      })
    )
    const { CodexRuntimeHomeService } = await import('./runtime-home-service')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the harness store implements the getSettings/updateSettings surface the service reads.
    const service = new CodexRuntimeHomeService(store as never)

    expect(service.prepareForCodexLaunchWithAccount(account('acct-pinned', pinnedHome))).toBe(
      pinnedHome
    )
    // The global launch still resolves the active account.
    expect(service.prepareForCodexLaunch()).toBe(activeHome)
    expect(store.getSettings().activeCodexManagedAccountIdsByRuntime?.host).toBe('acct-active')
  })

  it('declines an untrusted home instead of clearing anyone’s selection', async () => {
    const activeHome = createManagedAuth(testState.userDataDir, 'acct-active', '{"a":1}\n')
    const store = createStore(
      createSettings({
        codexManagedAccounts: [account('acct-active', activeHome)],
        activeCodexManagedAccountId: 'acct-active',
        activeCodexManagedAccountIdsByRuntime: { host: 'acct-active', wsl: {} }
      })
    )
    const { CodexRuntimeHomeService } = await import('./runtime-home-service')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the harness store implements the getSettings/updateSettings surface the service reads.
    const service = new CodexRuntimeHomeService(store as never)

    expect(
      service.prepareForCodexLaunchWithAccount(account('acct-rogue', testState.fakeHomeDir))
    ).toBeNull()
    expect(store.getSettings().activeCodexManagedAccountIdsByRuntime?.host).toBe('acct-active')
  })
})
