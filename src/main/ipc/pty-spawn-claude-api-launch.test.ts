import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { spawnMock } from './pty-ipc-mock-registry'
import { makeDisposable } from './pty-ipc-test-constants'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import { hasLiveClaudePtys } from '../claude-accounts/live-pty-gate'
import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_KEY
} from '../../shared/claude-api-provider'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { registerPtyHandlers } from './pty'
import { registerClaudeApiLaunchSource } from '../claude-api/claude-api-launch'

const readClaudeApiKeyMock = vi.hoisted(() => vi.fn())
const holdsSessionMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => import('./pty-ipc-mock-registry').then((m) => m.electronModuleMock()))
vi.mock('fs', () => import('./pty-ipc-mock-registry').then((m) => m.fsModuleMock()))
vi.mock('node-pty', () => import('./pty-ipc-mock-registry').then((m) => m.nodePtyModuleMock()))
vi.mock('node:child_process', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).childProcessModuleMock(await importOriginal())
)
vi.mock('../opencode/hook-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.openCodeHookServiceModuleMock())
)
vi.mock('../mimo/hook-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.mimoHookServiceModuleMock())
)
vi.mock('../agent-hooks/server', () =>
  import('./pty-ipc-mock-registry').then((m) => m.agentHookServerModuleMock())
)
vi.mock('../pi/titlebar-extension-service', () =>
  import('./pty-ipc-mock-registry').then((m) => m.piTitlebarExtensionModuleMock())
)
vi.mock('../pwsh', () => import('./pty-ipc-mock-registry').then((m) => m.pwshModuleMock()))
vi.mock('../wsl', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).wslModuleMock(await importOriginal())
)
vi.mock('../telemetry/client', () =>
  import('./pty-ipc-mock-registry').then((m) => m.telemetryClientModuleMock())
)
vi.mock('../telemetry/classify-error', () =>
  import('./pty-ipc-mock-registry').then((m) => m.classifyErrorModuleMock())
)
vi.mock('../cli/linux-terminal-dolphin-cli-shim', () =>
  import('./pty-ipc-mock-registry').then((m) => m.linuxCliShimModuleMock())
)
vi.mock('../memory/pty-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.ptyRegistryModuleMock())
)
vi.mock('../agent-hooks/migration-unsupported-pty-state', () =>
  import('./pty-ipc-mock-registry').then((m) => m.migrationUnsupportedPtyModuleMock())
)
vi.mock('../codex/codex-pane-account-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexPaneAccountRegistryModuleMock())
)
vi.mock('../codex/codex-state-db-backfill-recovery', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexBackfillRecoveryModuleMock())
)
vi.mock('../claude-accounts/claude-api-key-store', () => ({
  readClaudeApiKey: readClaudeApiKeyMock
}))
vi.mock('../claude-api/claude-api-key-approval', () => ({
  preapproveClaudeApiKeyInProfile: vi.fn(async () => undefined)
}))
vi.mock('../claude-accounts/profile/claude-profile-hooks', () => ({
  installClaudeProfileHooks: vi.fn(async () => undefined)
}))
vi.mock('../claude-accounts/profile/claude-session-profile', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return { ...actual, claudeConfigDirHoldsSession: holdsSessionMock }
})

// A fake key: the suite never reads a real one.
const FAKE_KEY = 'sk-ant-api03-test-0000000000000000000000'
const PLAN_DIR = '/home/me/.dolphin/claude-accounts/plan/config'

function account(id: string, authMethod?: 'api-key'): ClaudeManagedAccount {
  const base: ClaudeManagedAccount = {
    id,
    email: authMethod ? '' : `${id}@example.com`,
    authMethod: 'subscription-oauth',
    managedAuthPath: `/managed/${id}`,
    managedAuthRuntime: 'host',
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
  return authMethod ? { ...base, authMethod, label: `API ${id}` } : base
}

const INHERITED_CONFLICTS = {
  ANTHROPIC_AUTH_TOKEN: 'inherited-token',
  CLAUDE_CODE_OAUTH_TOKEN: 'inherited-oauth',
  ANTHROPIC_BASE_URL: 'https://proxy.example.com',
  CLAUDE_CODE_USE_BEDROCK: '1',
  CLAUDE_CODE_USE_VERTEX: '1'
}

describe('claude-api PTY spawn', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()

  function managedClaudeAuth() {
    return vi.fn(async () => ({
      configDir: PLAN_DIR,
      envPatch: { CLAUDE_CONFIG_DIR: PLAN_DIR },
      stripAuthEnv: true,
      provenance: 'managed:plan'
    }))
  }

  async function spawn(
    prepareClaudeAuth: ReturnType<typeof managedClaudeAuth>,
    accounts: ClaudeManagedAccount[],
    args: Record<string, unknown>
  ): Promise<{ id: string; env: Record<string, string> }> {
    let exitCb: ((info: { exitCode: number }) => void) | undefined
    spawnMock.mockReturnValue({
      onData: vi.fn(() => makeDisposable()),
      onExit: vi.fn((cb: (info: { exitCode: number }) => void) => {
        exitCb = cb
        return makeDisposable()
      }),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(() => exitCb?.({ exitCode: -1 })),
      process: 'zsh',
      pid: 4242
    })
    handlers.clear()
    const settings = {
      claudeManagedAccounts: accounts,
      activeClaudeManagedAccountId: 'plan',
      codexManagedAccounts: []
    }
    registerPtyHandlers(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the shared pty IPC harness window implements only the webContents calls spawn uses.
      mainWindow as never,
      undefined,
      undefined,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: spawn reads only the account fields set here.
      () => settings as never,
      prepareClaudeAuth
    )
    const result: unknown = await handlers.get('pty:spawn')?.(null, { cols: 80, rows: 24, ...args })
    const id = z.object({ id: z.string() }).safeParse(result).data?.id
    if (typeof id !== 'string') {
      throw new Error('spawn returned no pty id')
    }
    const env: Record<string, string> = spawnMock.mock.calls.at(-1)?.[2]?.env
    return { id, env }
  }

  beforeEach(() => {
    registerClaudeApiLaunchSource({
      worktreeSource: { getWorktreeMeta: () => undefined, getAllWorktreeMeta: () => ({}) },
      configDirFor: (entry) => `/home/me/.dolphin/claude-accounts/${entry.id}/config`
    })
    readClaudeApiKeyMock.mockReset()
    readClaudeApiKeyMock.mockReturnValue(FAKE_KEY)
    holdsSessionMock.mockReset()
    holdsSessionMock.mockReturnValue(false)
    spawnMock.mockClear()
    for (const [key, value] of Object.entries(INHERITED_CONFLICTS)) {
      vi.stubEnv(key, value)
    }
  })

  afterEach(() => {
    registerClaudeApiLaunchSource(null)
    vi.unstubAllEnvs()
  })

  it('runs in the API account profile with its key, skipping the plan gate', async () => {
    const prepareClaudeAuth = managedClaudeAuth()
    const { id, env } = await spawn(
      prepareClaudeAuth,
      [account('plan'), account('api1', 'api-key')],
      {
        command: 'claude',
        launchAgent: 'claude-api',
        // Would trip the managed-account auth conflict check on a plan launch.
        env: { ANTHROPIC_API_KEY: 'sk-other' }
      }
    )
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
    expect(readClaudeApiKeyMock).toHaveBeenCalledWith('api1')
    expect(env.ANTHROPIC_API_KEY).toBe(FAKE_KEY)
    expect(env.CLAUDE_CONFIG_DIR).toMatch(/api1[\\/]config$/)
    expect(env.CLAUDE_CONFIG_DIR).not.toBe(PLAN_DIR)
    expect(env[CLAUDE_API_PROVIDER_ENV_KEY]).toBe('anthropic-api')
    expect(env[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api1')
    expect(hasLiveClaudePtys()).toBe(false)
    await handlers.get('pty:kill')!(null, { id })
  })

  it('strips inherited auth that would bill another login or endpoint', async () => {
    const { id, env } = await spawn(managedClaudeAuth(), [account('api1', 'api-key')], {
      command: 'claude',
      launchAgent: 'claude-api',
      env: { ANTHROPIC_BASE_URL: 'https://explicit.example.com' }
    })
    for (const key of Object.keys(INHERITED_CONFLICTS)) {
      expect(env[key]).toBeUndefined()
    }
    expect(env.ANTHROPIC_API_KEY).toBe(FAKE_KEY)
    await handlers.get('pty:kill')!(null, { id })
  })

  it('keeps its key even when the caller asks to delete it', async () => {
    const { id, env } = await spawn(managedClaudeAuth(), [account('api1', 'api-key')], {
      command: 'claude',
      launchAgent: 'claude-api',
      envToDelete: ['ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR']
    })
    expect(env.ANTHROPIC_API_KEY).toBe(FAKE_KEY)
    expect(env.CLAUDE_CONFIG_DIR).toMatch(/api1[\\/]config$/)
    await handlers.get('pty:kill')!(null, { id })
  })

  it('refuses with no API account instead of starting on the plan', async () => {
    const prepareClaudeAuth = managedClaudeAuth()
    await expect(
      spawn(prepareClaudeAuth, [account('plan')], { command: 'claude', launchAgent: 'claude-api' })
    ).rejects.toThrow('needs an API account')
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses when the account has no saved key', async () => {
    readClaudeApiKeyMock.mockReturnValue(null)
    await expect(
      spawn(managedClaudeAuth(), [account('api1', 'api-key')], {
        command: 'claude',
        launchAgent: 'claude-api'
      })
    ).rejects.toThrow('has no API key')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses when this process has no Claude account service', async () => {
    registerClaudeApiLaunchSource(null)
    await expect(
      spawn(managedClaudeAuth(), [account('api1', 'api-key')], {
        command: 'claude',
        launchAgent: 'claude-api'
      })
    ).rejects.toThrow('not available in this process')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('refuses on an SSH connection', async () => {
    await expect(
      spawn(managedClaudeAuth(), [account('api1', 'api-key')], {
        command: 'claude',
        launchAgent: 'claude-api',
        connectionId: 'ssh-1'
      })
    ).rejects.toThrow()
    expect(readClaudeApiKeyMock).not.toHaveBeenCalled()
  })

  it('resumes a plain claude session from an API profile as claude-api on that account', async () => {
    holdsSessionMock.mockImplementation((configDir: string) => /api2[\\/]config$/.test(configDir))
    const prepareClaudeAuth = managedClaudeAuth()
    const { id, env } = await spawn(
      prepareClaudeAuth,
      [account('plan'), account('api1', 'api-key'), account('api2', 'api-key')],
      { command: 'claude --resume 11111111-2222-3333-4444-555555555555', launchAgent: 'claude' }
    )
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
    expect(readClaudeApiKeyMock).toHaveBeenCalledWith('api2')
    expect(env.CLAUDE_CONFIG_DIR).toMatch(/api2[\\/]config$/)
    expect(env[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api2')
    await handlers.get('pty:kill')!(null, { id })
  })

  it('leaves a plain claude resume on the plan when no API profile holds it', async () => {
    const prepareClaudeAuth = managedClaudeAuth()
    const { id, env } = await spawn(
      prepareClaudeAuth,
      [account('plan'), account('api1', 'api-key')],
      {
        command: 'claude --resume 11111111-2222-3333-4444-555555555555',
        launchAgent: 'claude'
      }
    )
    expect(prepareClaudeAuth).toHaveBeenCalledTimes(1)
    expect(readClaudeApiKeyMock).not.toHaveBeenCalled()
    expect(env.CLAUDE_CONFIG_DIR).toBe(PLAN_DIR)
    expect(env[CLAUDE_API_PROVIDER_ENV_KEY]).toBeUndefined()
    await handlers.get('pty:kill')!(null, { id })
  })
})
