import {
  cleanupRuntimeAuthTestState,
  createClaudeAccount,
  createClaudeCredentialsJson,
  createClaudeCredentialsWithoutEmail,
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
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isOauthTokenExpiring, refreshClaudeOauthCredentials } from './oauth-refresh'

vi.mock('electron', () => createElectronMock())
vi.mock('./oauth-refresh', () => createOauthRefreshMock())
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  return { ...actual, homedir: () => testState.fakeHomeDir }
})
vi.mock('./keychain', () => createKeychainMock())

function profileDir(accountId: string): string {
  return join(testState.userDataDir, 'claude-accounts', accountId, 'config')
}

function userCredentialsPath(): string {
  return join(testState.fakeHomeDir, '.claude', '.credentials.json')
}

function readProfileCredentials(accountId: string): string {
  return readFileSync(join(profileDir(accountId), '.credentials.json'), 'utf-8')
}

type Accounts = { id: string; email: string; credentials: string; organizationUuid?: string }[]

function setup(accounts: Accounts, active: string | null) {
  const paths = new Map<string, string>()
  const settings = createSettings({
    claudeManagedAccounts: accounts.map((account) => {
      const path = createManagedClaudeAuth(
        testState.userDataDir,
        account.id,
        account.credentials,
        `${JSON.stringify({ accountUuid: account.id, emailAddress: account.email })}\n`
      )
      paths.set(account.id, path)
      return createClaudeAccount(account.id, path, {
        email: account.email,
        organizationUuid: account.organizationUuid ?? null
      })
    }),
    activeClaudeManagedAccountId: active
  })
  return { store: createStore(settings), settings, paths }
}

async function newService(store: ReturnType<typeof createStore>) {
  const { ClaudeRuntimeAuthService } = await import('./runtime-auth-service')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake store implements every Store method the auth service calls.
  return new ClaudeRuntimeAuthService(store as never)
}

describe('ClaudeRuntimeAuthService account profiles', () => {
  beforeEach(() => {
    resetRuntimeAuthTestState()
  })

  afterEach(() => {
    cleanupRuntimeAuthTestState()
    vi.mocked(isOauthTokenExpiring).mockReturnValue(false)
    vi.mocked(refreshClaudeOauthCredentials).mockResolvedValue(null)
  })

  it("launches the active account in its own profile and leaves the user's login alone", async () => {
    const userLogin = createClaudeCredentialsJson('me@personal.test', 'mine')
    writeFileSync(userCredentialsPath(), userLogin)
    testState.legacyKeychainCredentials = userLogin
    const work = createClaudeCredentialsJson('me@corp.test', 'work')
    const { store } = setup([{ id: 'work', email: 'me@corp.test', credentials: work }], 'work')
    const service = await newService(store)

    const preparation = await service.prepareForClaudeLaunch()

    expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: profileDir('work') })
    expect(service.getRuntimeConfigDir()).toBe(profileDir('work'))
    expect(readProfileCredentials('work')).toBe(work)
    expect(testState.pinnedKeychainCredentials.get(profileDir('work'))).toBe(work)
    expect(readFileSync(userCredentialsPath(), 'utf-8')).toBe(userLogin)
    expect(testState.legacyKeychainCredentials).toBe(userLogin)
  })

  it("switches profiles without carrying one account's state into the other", async () => {
    const one = createClaudeCredentialsJson('one@example.test', 'one')
    const two = createClaudeCredentialsJson('two@example.test', 'two')
    const { store } = setup(
      [
        { id: 'one', email: 'one@example.test', credentials: one },
        { id: 'two', email: 'two@example.test', credentials: two }
      ],
      'one'
    )
    const service = await newService(store)
    await service.prepareForClaudeLaunch()

    store.updateSettings({ activeClaudeManagedAccountId: 'two' })
    const preparation = await service.prepareForClaudeLaunch()

    expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: profileDir('two') })
    expect(readProfileCredentials('two')).toBe(two)
    expect(readProfileCredentials('one')).toBe(one)
    expect(
      JSON.parse(readFileSync(join(profileDir('two'), '.claude.json'), 'utf-8')).oauthAccount
    ).toMatchObject({ accountUuid: 'two' })
  })

  it('uses the system profile once no managed account is selected', async () => {
    const one = createClaudeCredentialsJson('one@example.test', 'one')
    const { store } = setup([{ id: 'one', email: 'one@example.test', credentials: one }], 'one')
    const service = await newService(store)
    await service.prepareForClaudeLaunch()

    store.updateSettings({ activeClaudeManagedAccountId: null })
    const preparation = await service.prepareForClaudeLaunch()

    expect(preparation.envPatch).toEqual({})
    expect(service.getRuntimeConfigDir()).toBe(join(testState.fakeHomeDir, '.claude'))
    expect(existsSync(userCredentialsPath())).toBe(false)
  })

  it('refuses to launch an account with unusable credentials instead of using the user login', async () => {
    for (const credentials of ['{not-json', '{"claudeAiOauth":"wrong-shape"}\n']) {
      resetRuntimeAuthTestState()
      const userLogin = createClaudeCredentialsJson('me@personal.test', 'mine')
      writeFileSync(userCredentialsPath(), userLogin)
      const { store } = setup([{ id: 'one', email: 'one@example.test', credentials }], 'one')
      const service = await newService(store)

      await expect(service.prepareForClaudeLaunch()).rejects.toThrow('invalid credentials')
      expect(store.getSettings().activeClaudeManagedAccountId).toBe('one')
      expect(readFileSync(userCredentialsPath(), 'utf-8')).toBe(userLogin)
    }
  })

  it('refuses credentials from an auth dir Dolphin does not own', async () => {
    const unowned = join(testState.fakeHomeDir, 'unowned-claude-auth')
    mkdirSync(unowned, { recursive: true })
    writeFileSync(
      join(unowned, '.credentials.json'),
      createClaudeCredentialsJson('one@example.test', 'one')
    )
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('one', unowned, { email: 'one@example.test' })],
      activeClaudeManagedAccountId: 'one'
    })
    const service = await newService(createStore(settings))

    await expect(service.prepareForClaudeLaunch()).rejects.toThrow('invalid credentials')
    expect(existsSync(join(profileDir('one'), '.credentials.json'))).toBe(false)
  })

  it.skipIf(process.platform === 'win32')(
    'refuses a credentials file that links outside the managed store',
    async () => {
      setPlatform('linux')
      const authPath = join(testState.userDataDir, 'claude-accounts', 'one', 'auth')
      mkdirSync(authPath, { recursive: true })
      writeFileSync(join(authPath, '.dolphin-managed-claude-auth'), 'one\n')
      const escaped = join(testState.fakeHomeDir, 'escaped-credentials.json')
      writeFileSync(escaped, createClaudeCredentialsJson('one@example.test', 'escaped'))
      symlinkSync(escaped, join(authPath, '.credentials.json'))
      const settings = createSettings({
        claudeManagedAccounts: [
          createClaudeAccount('one', authPath, { email: 'one@example.test' })
        ],
        activeClaudeManagedAccountId: 'one'
      })
      const service = await newService(createStore(settings))

      await expect(service.prepareForClaudeLaunch()).rejects.toThrow('invalid credentials')
      expect(existsSync(join(profileDir('one'), '.credentials.json'))).toBe(false)
    }
  )

  it('adopts a canonical managed auth dir that predates the ownership marker', async () => {
    setPlatform('linux')
    const credentials = createClaudeCredentialsJson('one@example.test', 'one')
    const authPath = join(testState.userDataDir, 'claude-accounts', 'one', 'auth')
    mkdirSync(authPath, { recursive: true })
    writeFileSync(join(authPath, '.credentials.json'), credentials)
    const settings = createSettings({
      claudeManagedAccounts: [createClaudeAccount('one', authPath, { email: 'one@example.test' })],
      activeClaudeManagedAccountId: 'one'
    })
    const service = await newService(createStore(settings))

    await service.prepareForClaudeLaunch()

    expect(readProfileCredentials('one')).toBe(credentials)
    expect(lstatSync(join(authPath, '.dolphin-managed-claude-auth')).isFile()).toBe(true)
  })

  describe('reading back what the CLI rotated in the profile', () => {
    async function launchedOnce(organizationUuid?: string) {
      setPlatform('linux')
      const managed = createClaudeCredentialsJson('one@example.test', 'one', organizationUuid)
      const { store, paths } = setup(
        [{ id: 'one', email: 'one@example.test', credentials: managed, organizationUuid }],
        'one'
      )
      const service = await newService(store)
      await service.prepareForClaudeLaunch()
      const authPath = paths.get('one') ?? ''
      return { service, managed, authPath }
    }

    function writeProfile(credentials: string): void {
      writeFileSync(join(profileDir('one'), '.credentials.json'), credentials)
    }

    it('adopts a newer token for the same identity', async () => {
      const { service, authPath } = await launchedOnce()
      const rotated = createClaudeCredentialsJson('one@example.test', 'rotated', null, 9e12)
      writeProfile(rotated)

      await service.prepareForClaudeLaunch()

      expect(readManagedCredentialsForTest('one', authPath)).toBe(rotated)
    })

    it('adopts an identity-less refresh only when the refresh token proves the account', async () => {
      const { service, authPath, managed } = await launchedOnce()
      const proven = createClaudeCredentialsWithoutEmail('one-next', null, {
        refreshToken: 'one-refresh',
        expiresAt: 9e12
      })
      writeProfile(proven)
      await service.prepareForClaudeLaunch()
      expect(readManagedCredentialsForTest('one', authPath)).toBe(proven)

      // A `/login` as someone else inside the profile also rewrites its account card.
      writeProfile(
        createClaudeCredentialsWithoutEmail('stranger', null, {
          refreshToken: 'stranger-refresh',
          expiresAt: 9.5e12
        })
      )
      writeFileSync(
        join(profileDir('one'), '.claude.json'),
        JSON.stringify({ oauthAccount: { accountUuid: 'x', emailAddress: 'x@example.test' } })
      )
      await service.prepareForClaudeLaunch()
      expect(readManagedCredentialsForTest('one', authPath)).toBe(proven)
      expect(managed).not.toBe(proven)
    })

    it('rejects another identity, another organization, or an older token', async () => {
      const { service, authPath, managed } = await launchedOnce('org-a')
      for (const foreign of [
        createClaudeCredentialsJson('someone@example.test', 'foreign', 'org-a', 9e12),
        createClaudeCredentialsJson('one@example.test', 'other-org', 'org-b', 9e12),
        createClaudeCredentialsJson('one@example.test', 'older', 'org-a', 1_000)
      ]) {
        writeProfile(foreign)
        await service.prepareForClaudeLaunch()
        expect(readManagedCredentialsForTest('one', authPath)).toBe(managed)
        expect(readProfileCredentials('one')).toBe(managed)
      }
    })
  })

  it('refreshes an expired token before launch when no Claude terminal is live', async () => {
    const expired = createClaudeCredentialsJson('one@example.test', 'expired', null, 1_000)
    const refreshed = createClaudeCredentialsJson('one@example.test', 'refreshed', null, 9e12)
    const { store, paths } = setup(
      [{ id: 'one', email: 'one@example.test', credentials: expired }],
      'one'
    )
    vi.mocked(isOauthTokenExpiring).mockReturnValue(true)
    vi.mocked(refreshClaudeOauthCredentials).mockResolvedValue(refreshed)
    const service = await newService(store)

    await service.prepareForClaudeLaunch()

    expect(readManagedCredentialsForTest('one', paths.get('one') ?? '')).toBe(refreshed)
    expect(readProfileCredentials('one')).toBe(refreshed)
  })

  it('never refreshes while a Claude terminal is live, and says it deferred', async () => {
    const expired = createClaudeCredentialsJson('one@example.test', 'expired', null, 1_000)
    const { store } = setup([{ id: 'one', email: 'one@example.test', credentials: expired }], 'one')
    vi.mocked(isOauthTokenExpiring).mockReturnValue(true)
    const { markClaudePtySpawned, markClaudePtyExited } = await import('./live-pty-gate')
    const service = await newService(store)

    markClaudePtySpawned('pty-live')
    try {
      const preparation = await service.prepareForRateLimitFetch()
      expect(refreshClaudeOauthCredentials).not.toHaveBeenCalled()
      expect(preparation.managedRefreshDeferredByLivePty).toBe(true)
      expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: profileDir('one') })
    } finally {
      markClaudePtyExited('pty-live')
    }
  })

  describe('resuming a conversation', () => {
    const SESSION = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f'

    function writeTranscript(configDir: string): void {
      mkdirSync(join(configDir, 'projects', '-repo'), { recursive: true })
      writeFileSync(join(configDir, 'projects', '-repo', `${SESSION}.jsonl`), '{}\n')
    }

    async function twoAccounts() {
      const { store } = setup(
        [
          {
            id: 'one',
            email: 'one@example.test',
            credentials: createClaudeCredentialsJson('one@example.test', 'one')
          },
          {
            id: 'two',
            email: 'two@example.test',
            credentials: createClaudeCredentialsJson('two@example.test', 'two')
          }
        ],
        'one'
      )
      return { store, service: await newService(store) }
    }

    it('runs in the profile of the account that wrote the transcript', async () => {
      const { service } = await twoAccounts()
      writeTranscript(profileDir('two'))

      const preparation = await service.prepareForClaudeLaunch(undefined, {
        resumeSessionId: SESSION
      })

      expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: profileDir('two') })
    })

    it('keeps the usual profile when it holds the transcript or no profile does', async () => {
      const { service } = await twoAccounts()
      expect(
        (await service.prepareForClaudeLaunch(undefined, { resumeSessionId: SESSION })).envPatch
      ).toEqual({ CLAUDE_CONFIG_DIR: profileDir('one') })
      writeTranscript(profileDir('one'))
      writeTranscript(profileDir('two'))
      expect(
        (await service.prepareForClaudeLaunch(undefined, { resumeSessionId: SESSION })).envPatch
      ).toEqual({ CLAUDE_CONFIG_DIR: profileDir('one') })
    })

    it("runs a conversation from the user's own login in the system profile", async () => {
      const { service } = await twoAccounts()
      writeTranscript(join(testState.fakeHomeDir, '.claude'))

      const preparation = await service.prepareForClaudeLaunch(undefined, {
        resumeSessionId: SESSION
      })

      expect(preparation.envPatch).toEqual({})
      expect(preparation.stripAuthEnv).toBe(false)
      // Why asserted: this provenance is what lets the launch skip the user's account menu.
      expect(preparation.provenance).toBe('system:resume-owner')
    })

    it('resumes in the linked account on ~/.claude when Dolphin uses the system default', async () => {
      const systemDir = join(testState.fakeHomeDir, '.claude')
      mkdirSync(systemDir, { recursive: true })
      writeTranscript(systemDir)
      const service = await newService(
        createStore(
          createSettings({
            claudeManagedAccounts: [
              createClaudeAccount('pessoal', systemDir, {
                email: 'me@home.test',
                linkedConfigDir: systemDir
              })
            ],
            activeClaudeManagedAccountId: null
          })
        )
      )

      const preparation = await service.prepareForClaudeLaunch(undefined, {
        resumeSessionId: SESSION
      })

      expect(preparation.envPatch).toEqual({})
      expect(preparation.provenance).toBe('managed:pessoal:linked')
    })

    it('refuses when the owning account can no longer sign in', async () => {
      const { store } = setup(
        [
          {
            id: 'one',
            email: 'one@example.test',
            credentials: createClaudeCredentialsJson('one@example.test', 'one')
          },
          { id: 'two', email: 'two@example.test', credentials: '{not-json' }
        ],
        'one'
      )
      const service = await newService(store)
      writeTranscript(profileDir('two'))

      await expect(
        service.prepareForClaudeLaunch(undefined, { resumeSessionId: SESSION })
      ).rejects.toThrow('belongs to the Claude account two@example.test')
    })
  })

  describe('a folder the user already manages', () => {
    function linkedSettings(configDir: string) {
      const settings = createSettings({
        claudeManagedAccounts: [
          createClaudeAccount('linked', configDir, {
            email: 'me@corp.test',
            linkedConfigDir: configDir
          })
        ],
        activeClaudeManagedAccountId: 'linked'
      })
      return createStore(settings)
    }

    it('launches in the folder itself and never writes a login or copies anything there', async () => {
      const folder = join(testState.fakeHomeDir, '.claude-empresa')
      mkdirSync(folder, { recursive: true })
      writeFileSync(
        join(folder, '.claude.json'),
        '{"oauthAccount":{"emailAddress":"me@corp.test"}}'
      )
      const service = await newService(linkedSettings(folder))

      const preparation = await service.prepareForClaudeLaunch()

      expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: folder })
      expect(service.getRuntimeConfigDir()).toBe(folder)
      expect(existsSync(join(folder, '.credentials.json'))).toBe(false)
      expect(existsSync(join(folder, '.dolphin-claude-profile.json'))).toBe(false)
      expect(testState.pinnedKeychainCredentials.size).toBe(0)
      expect(readFileSync(join(folder, '.claude.json'), 'utf-8')).toBe(
        '{"oauthAccount":{"emailAddress":"me@corp.test"}}'
      )
    })

    it("launches Claude's default folder without CLAUDE_CONFIG_DIR, keeping its login where it is", async () => {
      const service = await newService(linkedSettings(join(testState.fakeHomeDir, '.claude')))

      const preparation = await service.prepareForClaudeLaunch()

      expect(preparation.envPatch).toEqual({})
      expect(preparation.provenance).toBe('managed:linked:linked')
    })

    it('refuses when the linked folder is gone', async () => {
      const service = await newService(linkedSettings(join(testState.fakeHomeDir, '.claude-gone')))

      await expect(service.prepareForClaudeLaunch()).rejects.toThrow('no longer exists')
    })
  })

  describe('releasing ~/.claude from the earlier shared layout', () => {
    function writeSnapshot(systemCredentials: string): void {
      mkdirSync(join(testState.userDataDir, 'claude-runtime-auth'), { recursive: true })
      writeFileSync(
        join(testState.userDataDir, 'claude-runtime-auth', 'system-default-auth.json'),
        `${JSON.stringify({
          credentialsJson: systemCredentials,
          configOauthAccount: null,
          keychainCredentialsJson: systemCredentials,
          capturedAt: Date.now()
        })}\n`
      )
    }

    it("hands ~/.claude back to the user's own login, reading the CLI's rotation back first", async () => {
      const userLogin = createClaudeCredentialsJson('me@personal.test', 'mine')
      const managed = createClaudeCredentialsJson('one@example.test', 'one')
      const rotated = createClaudeCredentialsJson('one@example.test', 'rotated', null, 9e12)
      writeSnapshot(userLogin)
      // An earlier version materialized the active account here, and the CLI rotated it.
      writeFileSync(userCredentialsPath(), rotated)
      testState.scopedKeychainCredentials = rotated
      testState.legacyKeychainCredentials = rotated
      const { store, paths } = setup(
        [{ id: 'one', email: 'one@example.test', credentials: managed }],
        'one'
      )
      const service = await newService(store)

      const preparation = await service.prepareForClaudeLaunch()

      expect(readFileSync(userCredentialsPath(), 'utf-8')).toBe(userLogin)
      expect(testState.legacyKeychainCredentials).toBe(userLogin)
      expect(readManagedCredentialsForTest('one', paths.get('one') ?? '')).toBe(rotated)
      expect(preparation.envPatch).toEqual({ CLAUDE_CONFIG_DIR: profileDir('one') })
      expect(readProfileCredentials('one')).toBe(rotated)
    })

    it('leaves a login the user made in ~/.claude themselves untouched', async () => {
      const ownLogin = createClaudeCredentialsJson('me@personal.test', 'own-login')
      writeSnapshot(createClaudeCredentialsJson('old@personal.test', 'old'))
      writeFileSync(userCredentialsPath(), ownLogin)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const managed = createClaudeCredentialsJson('one@example.test', 'one')
      const { store } = setup(
        [{ id: 'one', email: 'one@example.test', credentials: managed }],
        'one'
      )
      const service = await newService(store)

      await service.prepareForClaudeLaunch()
      await service.prepareForClaudeLaunch()

      expect(readFileSync(userCredentialsPath(), 'utf-8')).toBe(ownLogin)
      warn.mockRestore()
    })
  })
})
