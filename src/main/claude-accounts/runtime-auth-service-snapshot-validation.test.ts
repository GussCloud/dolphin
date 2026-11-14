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
  readRuntimeOauthAccountForTest,
  resetRuntimeAuthTestState,
  testState
} from './runtime-auth-service-test-harness'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('electron', () => createElectronMock())

vi.mock('./oauth-refresh', () => createOauthRefreshMock())

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return {
    ...actual,
    homedir: () => testState.fakeHomeDir
  }
})

vi.mock('./keychain', () => createKeychainMock())

describe('ClaudeRuntimeAuthService', () => {
  beforeEach(() => {
    resetRuntimeAuthTestState()
  })

  afterEach(() => {
    cleanupRuntimeAuthTestState()
  })

  it('treats corrupt system-default snapshots as missing and clears owned runtime auth', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const runtimeConfigPath = join(testState.fakeHomeDir, '.claude.json')
    const snapshotPath = join(
      testState.userDataDir,
      'claude-runtime-auth',
      'system-default-auth.json'
    )
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    mkdirSync(join(testState.userDataDir, 'claude-runtime-auth'), { recursive: true })
    writeFileSync(snapshotPath, '{not-json', 'utf-8')
    writeFileSync(runtimeCredentialsPath, managedCredentials, 'utf-8')
    writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify({ oauthAccount: { accountUuid: 'account-1' } })}\n`,
      'utf-8'
    )
    testState.scopedKeychainCredentials = managedCredentials
    testState.legacyKeychainCredentials = managedCredentials
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)],
      activeClaudeManagedAccountId: 'account-1'
    })
    const store = createStore(settings)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = null
    await service.syncForCurrentSelection()

    expect(existsSync(snapshotPath)).toBe(false)
    expect(existsSync(runtimeCredentialsPath)).toBe(false)
    expect(readRuntimeOauthAccountForTest()).toBeNull()
    expect(testState.scopedKeychainCredentials).toBeNull()
    expect(testState.legacyKeychainCredentials).toBeNull()
    warn.mockRestore()
  })

  it('treats wrong-shaped system-default snapshots as missing and clears owned runtime auth', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const runtimeConfigPath = join(testState.fakeHomeDir, '.claude.json')
    const snapshotPath = join(
      testState.userDataDir,
      'claude-runtime-auth',
      'system-default-auth.json'
    )
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    mkdirSync(join(testState.userDataDir, 'claude-runtime-auth'), { recursive: true })
    writeFileSync(
      snapshotPath,
      `${JSON.stringify({
        credentialsJson: { token: 'system' },
        keychainCredentialsJson: managedCredentials,
        scopedKeychainCredentialsJson: { token: 'scoped' },
        legacyKeychainCredentialsJson: managedCredentials,
        capturedAt: Date.now()
      })}\n`,
      'utf-8'
    )
    writeFileSync(runtimeCredentialsPath, managedCredentials, 'utf-8')
    writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify({ oauthAccount: { accountUuid: 'account-1' } })}\n`,
      'utf-8'
    )
    testState.scopedKeychainCredentials = managedCredentials
    testState.legacyKeychainCredentials = managedCredentials
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)],
      activeClaudeManagedAccountId: 'account-1'
    })
    const store = createStore(settings)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = null
    await service.syncForCurrentSelection()

    expect(existsSync(snapshotPath)).toBe(false)
    expect(existsSync(runtimeCredentialsPath)).toBe(false)
    expect(readRuntimeOauthAccountForTest()).toBeNull()
    expect(testState.scopedKeychainCredentials).toBeNull()
    expect(testState.legacyKeychainCredentials).toBeNull()
    warn.mockRestore()
  })

  it('treats snapshots missing all keychain credential fields as invalid', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const snapshotPath = join(
      testState.userDataDir,
      'claude-runtime-auth',
      'system-default-auth.json'
    )
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    mkdirSync(join(testState.userDataDir, 'claude-runtime-auth'), { recursive: true })
    writeFileSync(
      snapshotPath,
      `${JSON.stringify({
        credentialsJson: null,
        configOauthAccount: null,
        capturedAt: Date.now()
      })}\n`,
      'utf-8'
    )
    writeFileSync(runtimeCredentialsPath, managedCredentials, 'utf-8')
    testState.scopedKeychainCredentials = managedCredentials
    testState.legacyKeychainCredentials = managedCredentials
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)],
      activeClaudeManagedAccountId: 'account-1'
    })
    const store = createStore(settings)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = null
    await service.syncForCurrentSelection()

    expect(existsSync(snapshotPath)).toBe(false)
    expect(existsSync(runtimeCredentialsPath)).toBe(false)
    expect(testState.scopedKeychainCredentials).toBeNull()
    expect(testState.legacyKeychainCredentials).toBeNull()
    warn.mockRestore()
  })

  it('preserves invalid external runtime oauth metadata when deselecting', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const runtimeConfigPath = join(testState.fakeHomeDir, '.claude.json')
    const systemCredentials = createClaudeCredentialsJson('system@example.com', 'system')
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    writeFileSync(runtimeCredentialsPath, systemCredentials, 'utf-8')
    writeFileSync(runtimeConfigPath, `${JSON.stringify({})}\n`, 'utf-8')
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials,
      'null\n'
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)]
    })
    const store = createStore(settings)

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = 'account-1'
    await service.syncForCurrentSelection()

    writeFileSync(runtimeConfigPath, '{not-json', 'utf-8')
    settings.activeClaudeManagedAccountId = null
    await service.syncForCurrentSelection()

    expect(readFileSync(runtimeCredentialsPath, 'utf-8')).toBe(systemCredentials)
    expect(readFileSync(runtimeConfigPath, 'utf-8')).toBe('{not-json')
  })

  it('does not use skipped oauth writes as ownership proof on deselect', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const runtimeConfigPath = join(testState.fakeHomeDir, '.claude.json')
    const systemCredentials = createClaudeCredentialsJson('system@example.com', 'system')
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    const externalCredentials = createClaudeCredentialsJson('external@example.com', 'external')
    const managedOauthAccount = { accountUuid: 'account-1' }
    writeFileSync(runtimeCredentialsPath, systemCredentials, 'utf-8')
    writeFileSync(runtimeConfigPath, '{not-json', 'utf-8')
    testState.scopedKeychainCredentials = systemCredentials
    testState.legacyKeychainCredentials = systemCredentials
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials,
      `${JSON.stringify(managedOauthAccount)}\n`
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)]
    })
    const store = createStore(settings)

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = 'account-1'
    await service.syncForCurrentSelection()

    writeFileSync(runtimeCredentialsPath, externalCredentials, 'utf-8')
    writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify({ oauthAccount: managedOauthAccount })}\n`,
      'utf-8'
    )
    testState.scopedKeychainCredentials = externalCredentials
    testState.legacyKeychainCredentials = externalCredentials
    settings.activeClaudeManagedAccountId = null
    await service.syncForCurrentSelection()

    expect(readFileSync(runtimeCredentialsPath, 'utf-8')).toBe(externalCredentials)
    expect(readRuntimeOauthAccountForTest()).toEqual(managedOauthAccount)
    expect(testState.scopedKeychainCredentials).toBe(externalCredentials)
    expect(testState.legacyKeychainCredentials).toBe(externalCredentials)
  })

  it('preserves external oauth logout when managed oauth metadata is null', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const runtimeConfigPath = join(testState.fakeHomeDir, '.claude.json')
    const systemCredentials = createClaudeCredentialsJson('system@example.com', 'system')
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    writeFileSync(runtimeCredentialsPath, systemCredentials, 'utf-8')
    writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify({ oauthAccount: { accountUuid: 'system-account' } })}\n`,
      'utf-8'
    )
    testState.scopedKeychainCredentials = systemCredentials
    testState.legacyKeychainCredentials = systemCredentials
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials,
      'null\n'
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)]
    })
    const store = createStore(settings)

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = 'account-1'
    await service.syncForCurrentSelection()

    rmSync(runtimeCredentialsPath, { force: true })
    testState.scopedKeychainCredentials = null
    testState.legacyKeychainCredentials = null
    writeFileSync(runtimeConfigPath, `${JSON.stringify({})}\n`, 'utf-8')
    settings.activeClaudeManagedAccountId = null
    await service.syncForCurrentSelection()

    expect(existsSync(runtimeCredentialsPath)).toBe(false)
    expect(readRuntimeOauthAccountForTest()).toBeNull()
    expect(testState.scopedKeychainCredentials).toBeNull()
    expect(testState.legacyKeychainCredentials).toBeNull()
  })

  it('restores owned oauth metadata during rollback after removing the added account', async () => {
    const runtimeCredentialsPath = join(testState.fakeHomeDir, '.claude', '.credentials.json')
    const runtimeConfigPath = join(testState.fakeHomeDir, '.claude.json')
    const systemCredentials = createClaudeCredentialsJson('system@example.com', 'system')
    const managedCredentials = createClaudeCredentialsJson('user@example.com', 'managed')
    const systemOauthAccount = { accountUuid: 'system-account' }
    writeFileSync(runtimeCredentialsPath, systemCredentials, 'utf-8')
    writeFileSync(
      runtimeConfigPath,
      `${JSON.stringify({ oauthAccount: systemOauthAccount })}\n`,
      'utf-8'
    )
    const managedAuthPath = createManagedClaudeAuth(
      testState.userDataDir,
      'account-1',
      managedCredentials,
      '{"accountUuid":"account-1"}\n'
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('account-1', managedAuthPath)]
    })
    const store = createStore(settings)

    const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
    const service = new ClaudeRuntimeAuthService(store as never)
    settings.activeClaudeManagedAccountId = 'account-1'
    await service.syncForCurrentSelection()

    settings.activeClaudeManagedAccountId = null
    settings.claudeManagedAccounts = []
    await service.forceMaterializeCurrentSelectionForRollback()

    expect(readFileSync(runtimeCredentialsPath, 'utf-8')).toBe(systemCredentials)
    expect(readRuntimeOauthAccountForTest()).toEqual(systemOauthAccount)
  })
})
