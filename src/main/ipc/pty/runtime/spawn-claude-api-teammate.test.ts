import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { getDefaultSettings } from '../../../../shared/constants'
import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  buildClaudeApiTeamEnv
} from '../../../../shared/claude-api-provider'
import type { ClaudeManagedAccount } from '../../../../shared/managed-account-types'
import { registerClaudeApiLaunchSource } from '../../../claude-api/claude-api-launch'
import { CLAUDE_API_ACCOUNT_GONE_MESSAGE } from '../../../claude-api/claude-api-launch-account'
import { finishPtyShutdown } from '../provider/liveness'
import { prepareRuntimePtySpawn } from './spawn-preflight'
import { buildRuntimePtySpawnOptions } from './spawn-options'
import { createRuntimePtySpawnState, type RuntimePtySpawnArgs } from './spawn-state'
import type { PtyRuntimeControllerDeps } from './controller-deps'

const readClaudeApiKeyMock = vi.hoisted(() => vi.fn())
vi.mock('../../../claude-accounts/claude-api-key-store', () => ({
  readClaudeApiKey: readClaudeApiKeyMock
}))
vi.mock('../../../claude-api/claude-api-key-approval', () => ({
  preapproveClaudeApiKeyInProfile: vi.fn(async () => undefined)
}))
vi.mock('../../../claude-accounts/profile/claude-profile-hooks', () => ({
  installClaudeProfileHooks: vi.fn(async () => undefined)
}))

// Fake keys: one per account, so the test sees which account's key was read.
const KEYS: Record<string, string> = {
  api1: 'sk-ant-fake-api1-000000000000000',
  api2: 'sk-ant-fake-api2-000000000000000'
}

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
  return authMethod ? { ...base, authMethod } : base
}

function makeDeps(): PtyRuntimeControllerDeps {
  const noCodexResumeLaunch: PtyRuntimeControllerDeps['noCodexResumeLaunch'] = (command) => ({
    codexResumeHome: null,
    command,
    notifyResumeUnavailable: false,
    droppedResumeArgv: false,
    providerSession: null
  })
  return {
    store: undefined,
    getSettings: () => ({
      ...getDefaultSettings('/tmp'),
      claudeManagedAccounts: [
        account('plan'),
        account('api1', 'api-key'),
        account('api2', 'api-key')
      ],
      activeClaudeManagedAccountId: 'plan',
      claudeApiDefaultAccountId: 'api1'
    }),
    adoptStablePane: async () => null,
    getLocalPtyStartupPromise: () => undefined,
    getLocalPtyProviderStartupPromise: () => undefined,
    prepareCodexResumeHome: () => null,
    resolveCodexResumeLaunch: async (command) => noCodexResumeLaunch(command),
    noCodexResumeLaunch,
    reconcileSharedRuntimeResumeHome: async (resumeHome) => resumeHome.codexHomePath,
    stripSequencedStartupResumeArgv: (env) => env,
    assertFolderWorkspacePtyPathUsable: () => undefined,
    resolvePtySpawnStartupCwd: (_worktreeId, cwd) => cwd,
    requestSerializedBuffer: async () => null,
    shutdownProviderAndDetectExit: async () => false,
    rememberSyntheticKillExit: () => {},
    rememberRetiredRejectedPty: () => {},
    sendPtyExitToRenderer: () => {},
    sendPtySpawnedToRenderer: () => {},
    finishPtyShutdown,
    trustedTerminalHandleEnv: new Set(),
    retiredRejectedPtyIds: new Map(),
    reversibleStopOwnersByPtyId: new Map(),
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only `operations.ts` (write/clearBuffer) reads `mainWindow`; the spawn preflight and option build never touch it, and a real BrowserWindow cannot exist in vitest.
    mainWindow: {} as BrowserWindow
  }
}

/** A teammate pane of an API-key team: the team env, spawned as `claude-api` by the split. */
async function spawnTeammate(accountId: string): Promise<{
  env: Record<string, string>
  envToDelete: readonly string[]
}> {
  const args: RuntimePtySpawnArgs = {
    cols: 120,
    rows: 40,
    command: "cd '/repo' && env CLAUDECODE=1 '/usr/bin/claude' --agent-id a",
    launchAgent: 'claude-api',
    env: { TMUX_PANE: '%2', ...buildClaudeApiTeamEnv(accountId) }
  }
  const ctx = createRuntimePtySpawnState(makeDeps(), args)
  try {
    await prepareRuntimePtySpawn(ctx)
    await buildRuntimePtySpawnOptions(ctx)
    return { env: ctx.spawnOptions.env ?? {}, envToDelete: ctx.spawnOptions.envToDelete ?? [] }
  } finally {
    ctx.finishTerminalInstall()
  }
}

describe.skipIf(process.platform === 'win32')('API-key Agent Teams teammate spawn', () => {
  beforeEach(() => {
    readClaudeApiKeyMock.mockReset()
    readClaudeApiKeyMock.mockImplementation((id: string) => KEYS[id] ?? null)
    registerClaudeApiLaunchSource({
      worktreeSource: { getWorktreeMeta: () => undefined, getAllWorktreeMeta: () => ({}) },
      configDirFor: (entry) => `/profiles/${entry.id}/config`
    })
  })

  afterEach(() => {
    registerClaudeApiLaunchSource(null)
  })

  it("runs on the leader's account, not the default and never the plan, reading its key fresh", async () => {
    const { env, envToDelete } = await spawnTeammate('api2')
    expect(readClaudeApiKeyMock).toHaveBeenCalledWith('api2')
    expect(env.ANTHROPIC_API_KEY).toBe(KEYS.api2)
    expect(env.CLAUDE_CONFIG_DIR).toBe('/profiles/api2/config')
    expect(env[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api2')
    expect(envToDelete).toEqual(
      expect.arrayContaining(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'])
    )
    expect(envToDelete).not.toContain('ANTHROPIC_API_KEY')
  })

  it('refuses a teammate whose leader account was removed', async () => {
    await expect(spawnTeammate('removed')).rejects.toThrow(CLAUDE_API_ACCOUNT_GONE_MESSAGE)
    expect(readClaudeApiKeyMock).not.toHaveBeenCalled()
  })

  it('refuses a teammate whose account has no key', async () => {
    readClaudeApiKeyMock.mockReturnValue(null)
    await expect(spawnTeammate('api2')).rejects.toThrow('has no API key')
  })
})
