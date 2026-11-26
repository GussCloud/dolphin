import { describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import {
  CLAUDE_API_SSH_UNSUPPORTED_MESSAGE,
  CLAUDE_API_UNREADABLE_KEY_MESSAGE,
  CLAUDE_API_WSL_UNSUPPORTED_MESSAGE,
  prepareClaudeApiLaunch,
  resolveClaudeApiTeamAccountId,
  type ClaudeApiLaunchDeps,
  type ClaudeApiLaunchRequest
} from './claude-api-launch'

vi.mock('electron', () => ({ app: { getPath: () => '/user-data' } }))

const API1: ClaudeManagedAccount = {
  id: 'api1',
  email: '',
  authMethod: 'api-key',
  managedAuthPath: '/managed/api1',
  managedAuthRuntime: 'host',
  createdAt: 1,
  updatedAt: 1,
  lastAuthenticatedAt: 1
}

function deps(overrides: Partial<ClaudeApiLaunchDeps> = {}): ClaudeApiLaunchDeps {
  return {
    readApiKey: () => 'sk-ant-fake-key-for-tests-0123456789',
    configDirFor: (account) => `/profiles/${account.id}/config`,
    holdsSession: () => false,
    worktreeSource: () => null,
    prepareProfile: vi.fn(async () => undefined),
    ...overrides
  }
}

function request(overrides: Partial<ClaudeApiLaunchRequest> = {}): ClaudeApiLaunchRequest {
  return {
    connectionId: null,
    target: { runtime: 'host' },
    settings: { claudeManagedAccounts: [API1] },
    launchEnv: undefined,
    command: 'claude',
    launch: {},
    ...overrides
  }
}

describe('prepareClaudeApiLaunch', () => {
  it('returns the profile dir, the key and both markers, after preparing the profile', async () => {
    const prepareProfile = vi.fn(async () => undefined)
    await expect(prepareClaudeApiLaunch(request(), deps({ prepareProfile }))).resolves.toEqual({
      CLAUDE_CONFIG_DIR: '/profiles/api1/config',
      ANTHROPIC_API_KEY: 'sk-ant-fake-key-for-tests-0123456789',
      DOLPHIN_CLAUDE_PROVIDER: 'anthropic-api',
      DOLPHIN_CLAUDE_API_ACCOUNT: 'api1'
    })
    expect(prepareProfile).toHaveBeenCalledWith(
      '/profiles/api1/config',
      'sk-ant-fake-key-for-tests-0123456789',
      expect.anything()
    )
  })

  it('refuses SSH and WSL before reading any key', async () => {
    const readApiKey = vi.fn(() => 'sk')
    await expect(
      prepareClaudeApiLaunch(request({ connectionId: 'ssh-1' }), deps({ readApiKey }))
    ).rejects.toThrow(CLAUDE_API_SSH_UNSUPPORTED_MESSAGE)
    await expect(
      prepareClaudeApiLaunch(request({ target: { runtime: 'wsl' } }), deps({ readApiKey }))
    ).rejects.toThrow(CLAUDE_API_WSL_UNSUPPORTED_MESSAGE)
    expect(readApiKey).not.toHaveBeenCalled()
  })

  it('refuses a key that cannot be decrypted', async () => {
    await expect(
      prepareClaudeApiLaunch(
        request(),
        deps({
          readApiKey: () => {
            throw new Error('decrypt failed')
          }
        })
      )
    ).rejects.toThrow(CLAUDE_API_UNREADABLE_KEY_MESSAGE)
  })

  it('bills the account whose profile holds the resumed session', async () => {
    const API2 = { ...API1, id: 'api2' }
    const env = await prepareClaudeApiLaunch(
      request({
        settings: { claudeManagedAccounts: [API1, API2], claudeApiDefaultAccountId: 'api1' },
        command: 'claude --resume 11111111-2222-3333-4444-555555555555'
      }),
      deps({ holdsSession: (configDir) => configDir.includes('api2') })
    )
    expect(env.DOLPHIN_CLAUDE_API_ACCOUNT).toBe('api2')
  })

  it("uses the launch worktree's API pin", async () => {
    const API2 = { ...API1, id: 'api2' }
    const env = await prepareClaudeApiLaunch(
      request({
        settings: { claudeManagedAccounts: [API1, API2], claudeApiDefaultAccountId: 'api1' },
        launch: { worktreeId: 'repo::/wt' }
      }),
      deps({
        worktreeSource: () => ({
          getWorktreeMeta: () => ({ agentAccountId: 'api2' }),
          getAllWorktreeMeta: () => ({})
        })
      })
    )
    expect(env.DOLPHIN_CLAUDE_API_ACCOUNT).toBe('api2')
  })
})

describe('resolveClaudeApiTeamAccountId', () => {
  it("follows a resumed transcript's owner over the pane account, as the leader's spawn does", () => {
    const API2 = { ...API1, id: 'api2' }
    const accountId = resolveClaudeApiTeamAccountId(
      {
        settings: { claudeManagedAccounts: [API1, API2] },
        launchEnv: { DOLPHIN_CLAUDE_API_ACCOUNT: 'api1' },
        command: 'claude --resume 11111111-2222-3333-4444-555555555555',
        launch: {}
      },
      deps({ holdsSession: (configDir) => configDir.includes('api2') })
    )
    expect(accountId).toBe('api2')
  })

  it('keeps the pane account when nothing outranks it', () => {
    const API2 = { ...API1, id: 'api2' }
    expect(
      resolveClaudeApiTeamAccountId(
        {
          settings: { claudeManagedAccounts: [API1, API2], claudeApiDefaultAccountId: 'api1' },
          launchEnv: { DOLPHIN_CLAUDE_API_ACCOUNT: 'api2' },
          command: 'claude',
          launch: {}
        },
        deps()
      )
    ).toBe('api2')
  })
})
