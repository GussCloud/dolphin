import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'

const FAKE_KEY = 'sk-ant-test-fake'
const paths = vi.hoisted(() => ({ userData: '', home: '' }))
const secretStore = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) => Buffer.from(`enc:${Buffer.from(value).toString('hex')}`)),
  decryptString: vi.fn((value: Buffer) =>
    Buffer.from(value.toString('utf8').slice(4), 'hex').toString('utf8')
  )
}))

vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }))
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return { ...actual, homedir: () => paths.home }
})
vi.mock('../../shared/secret-store', () => ({ getSecretStore: () => secretStore }))
vi.mock('./keychain', () => ({
  deleteManagedClaudeKeychainCredentials: vi.fn(async () => {}),
  readManagedClaudeKeychainCredentials: vi.fn(async () => null),
  writeManagedClaudeKeychainCredentials: vi.fn(async () => {})
}))

function profileDir(accountId: string): string {
  return join(paths.userData, 'claude-accounts', accountId, 'config')
}

function keyPath(accountId: string): string {
  return join(paths.home, FORK_HOME_STATE_DIR_NAME, 'claude-api-keys', `${accountId}.enc`)
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function planAccount(): ClaudeManagedAccount {
  const config = profileDir('plan')
  mkdirSync(config, { recursive: true })
  writeFileSync(join(config, 'CLAUDE.md'), '# plan instructions\n')
  writeFileSync(
    join(config, 'settings.json'),
    JSON.stringify({
      apiKeyHelper: 'print-key',
      forceLoginMethod: 'claudeai',
      model: 'opus',
      env: { ANTHROPIC_API_KEY: 'sk-ant-test-other-fake', ANTHROPIC_BASE_URL: 'x', KEEP: '1' }
    })
  )
  writeFileSync(join(config, '.credentials.json'), '{"claudeAiOauth":{"accessToken":"t"}}')
  writeFileSync(
    join(config, '.claude.json'),
    JSON.stringify({
      oauthAccount: { emailAddress: 'plan@example.test' },
      mcpServers: { docs: { command: 'docs-mcp' } }
    })
  )
  return {
    id: 'plan',
    email: 'plan@example.test',
    managedAuthPath: join(paths.userData, 'claude-accounts', 'plan', 'auth'),
    managedAuthRuntime: 'host',
    authMethod: 'subscription-oauth',
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
}

type FakeSettings = {
  claudeManagedAccounts: ReturnType<typeof planAccount>[]
  activeClaudeManagedAccountId: string
  activeClaudeManagedAccountIdsByRuntime: { host: string; wsl: Record<string, string> }
  claudeApiDefaultAccountId: string | null
}

async function createService() {
  let settings: FakeSettings = {
    claudeManagedAccounts: [planAccount()],
    activeClaudeManagedAccountId: 'plan',
    activeClaudeManagedAccountIdsByRuntime: { host: 'plan', wsl: {} },
    claudeApiDefaultAccountId: null
  }
  const store = {
    getSettings: () => settings,
    updateSettings: (updates: Partial<typeof settings>) => {
      settings = { ...settings, ...updates }
      return settings
    }
  }
  const runtimeAuth = {
    syncForCurrentSelection: vi.fn(async () => {}),
    forceMaterializeCurrentSelectionForRollback: vi.fn(async () => {})
  }
  const rateLimits = {
    evictInactiveClaudeCache: vi.fn(),
    refreshForClaudeAccountChange: vi.fn(async () => {})
  }
  const { ClaudeAccountService } = await import('./service')
  const service = new ClaudeAccountService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake store implements every Store method the service calls.
    store as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every rate-limit call removal makes.
    rateLimits as never,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every runtime-auth call removal makes.
    runtimeAuth as never
  )
  return { service, store }
}

describe('ClaudeAccountService API key accounts', () => {
  beforeEach(() => {
    vi.resetModules()
    secretStore.isEncryptionAvailable.mockReturnValue(true)
    paths.userData = mkdtempSync(join(tmpdir(), 'dolphin-claude-api-data-'))
    paths.home = mkdtempSync(join(tmpdir(), 'dolphin-claude-api-home-'))
    mkdirSync(join(paths.home, '.claude'), { recursive: true })
  })

  afterEach(() => {
    rmSync(paths.userData, { recursive: true, force: true })
    rmSync(paths.home, { recursive: true, force: true })
  })

  it('creates an isolated profile and keeps the key only encrypted', async () => {
    const { service } = await createService()

    const state = await service.addApiKeyAccount({ label: ' Work API ', apiKey: FAKE_KEY })

    const account = state.accounts.find((entry) => entry.authMethod === 'api-key')
    expect(account).toMatchObject({ label: 'Work API', email: '', managedAuthRuntime: 'host' })
    const id = account!.id
    expect(readFileSync(keyPath(id), 'utf-8')).not.toContain(FAKE_KEY)
    expect(existsSync(join(profileDir(id), '.dolphin-claude-profile.json'))).toBe(true)
    expect(readJson(join(profileDir(id), '.claude.json'))).toMatchObject({
      hasCompletedOnboarding: true,
      // Pre-approved, so the first launch does not stop at Claude Code's API key question.
      customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)] }
    })
    expect(service.getApiKeyStatus(id)).toEqual({
      apiKeyConfigured: true,
      encryptionAvailable: true
    })
    // The plan account stays the one plain `claude` launches use.
    expect(state.activeAccountId).toBe('plan')
  })

  it('copies a profile without credentials, identity or settings that pick other credentials', async () => {
    const { service } = await createService()

    const state = await service.addApiKeyAccount({
      label: 'Copy',
      apiKey: FAKE_KEY,
      copyFromAccountId: 'plan'
    })

    const id = state.accounts.find((entry) => entry.authMethod === 'api-key')!.id
    const dir = profileDir(id)
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8')).toBe('# plan instructions\n')
    expect(readJson(join(dir, 'settings.json'))).toEqual({ model: 'opus', env: { KEEP: '1' } })
    expect(existsSync(join(dir, '.credentials.json'))).toBe(false)
    const state2 = readJson(join(dir, '.claude.json'))
    expect(state2.oauthAccount).toBeUndefined()
    expect(state2.mcpServers).toEqual({ docs: { command: 'docs-mcp' } })
  })

  it('refuses without secure storage and leaves nothing behind', async () => {
    secretStore.isEncryptionAvailable.mockReturnValue(false)
    const { service, store } = await createService()

    await expect(service.addApiKeyAccount({ label: 'Work', apiKey: FAKE_KEY })).rejects.toThrow(
      /Secure storage is unavailable/
    )

    expect(store.getSettings().claudeManagedAccounts.map((entry) => entry.id)).toEqual(['plan'])
    expect(existsSync(join(paths.home, FORK_HOME_STATE_DIR_NAME, 'claude-api-keys'))).toBe(false)
  })

  it('never lets an API account become the active account or log in', async () => {
    const { service } = await createService()
    const state = await service.addApiKeyAccount({ label: 'Work', apiKey: FAKE_KEY })
    const id = state.accounts.find((entry) => entry.authMethod === 'api-key')!.id

    await expect(service.selectAccount(id)).rejects.toThrow(/cannot be the active/)
    await expect(service.reauthenticateAccount(id)).rejects.toThrow(/no Claude login/)
    expect(service.listAccounts().activeAccountId).toBe('plan')
  })

  it('replaces the key of an API account only', async () => {
    const { service } = await createService()
    const state = await service.addApiKeyAccount({ label: 'Work', apiKey: FAKE_KEY })
    const id = state.accounts.find((entry) => entry.authMethod === 'api-key')!.id

    await expect(service.replaceApiKey('plan', FAKE_KEY)).rejects.toThrow(/not an API account/)
    const before = readFileSync(keyPath(id), 'utf-8')
    await service.replaceApiKey(id, 'sk-ant-test-fake-2')
    expect(readFileSync(keyPath(id), 'utf-8')).not.toBe(before)
    expect(readJson(join(profileDir(id), '.claude.json'))).toMatchObject({
      // The replaced key's approval is dropped.
      customApiKeyResponses: { approved: ['sk-ant-test-fake-2'.slice(-20)], rejected: [] }
    })
  })

  it('deletes the key and the profile when the account is removed', async () => {
    const { service, store } = await createService()
    const state = await service.addApiKeyAccount({ label: 'Work', apiKey: FAKE_KEY })
    const id = state.accounts.find((entry) => entry.authMethod === 'api-key')!.id
    store.updateSettings({ claudeApiDefaultAccountId: id })

    await service.removeAccount(id)

    // A default naming a removed account would refuse every claude-api launch.
    expect(store.getSettings().claudeApiDefaultAccountId).toBeNull()

    expect(existsSync(keyPath(id))).toBe(false)
    expect(existsSync(join(paths.userData, 'claude-accounts', id))).toBe(false)
    expect(service.listAccounts().accounts.map((entry) => entry.id)).toEqual(['plan'])
  })

  it('keeps the account and its profile when its key cannot be deleted', async () => {
    const { service } = await createService()
    const state = await service.addApiKeyAccount({ label: 'Work', apiKey: FAKE_KEY })
    const id = state.accounts.find((entry) => entry.authMethod === 'api-key')!.id
    // A non-empty folder where the key file was makes the key delete throw.
    rmSync(keyPath(id))
    mkdirSync(join(keyPath(id), 'stuck'), { recursive: true })

    await expect(service.removeAccount(id)).rejects.toThrow()

    expect(service.listAccounts().accounts.map((entry) => entry.id)).toContain(id)
    expect(existsSync(join(profileDir(id), '.dolphin-claude-profile.json'))).toBe(true)
  })
})
