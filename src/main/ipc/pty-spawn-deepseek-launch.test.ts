import { describe, expect, it, vi } from 'vitest'
import { spawnMock } from './pty-ipc-mock-registry'
import { makeDisposable } from './pty-ipc-test-constants'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import { hasLiveClaudePtys } from '../claude-accounts/live-pty-gate'
import { DEEPSEEK_PROVIDER_ENV_KEY } from '../../shared/deepseek-claude-provider'
import { registerPtyHandlers } from './pty'

const prepareDeepSeekLaunchMock = vi.hoisted(() => vi.fn())

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
vi.mock('../deepseek/deepseek-config-home-setup', () => ({
  prepareDeepSeekLaunch: prepareDeepSeekLaunchMock
}))

const DEEPSEEK_ENV = {
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_AUTH_TOKEN: 'sk-deepseek',
  CLAUDE_CONFIG_DIR: '/home/me/.claude-deepseek',
  [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek'
}

describe('DeepSeek PTY spawn', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()

  function managedClaudeAuth() {
    return vi.fn(async () => ({
      configDir: '/home/me/.dolphin/claude-accounts/a1',
      envPatch: { CLAUDE_CONFIG_DIR: '/home/me/.dolphin/claude-accounts/a1' },
      stripAuthEnv: true,
      provenance: 'managed:a1'
    }))
  }

  async function spawn(
    prepareClaudeAuth: ReturnType<typeof managedClaudeAuth>,
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
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the shared pty IPC harness window implements only the webContents calls spawn uses.
    registerPtyHandlers(mainWindow as never, undefined, undefined, undefined, prepareClaudeAuth)
    const result: unknown = await handlers.get('pty:spawn')?.(null, { cols: 80, rows: 24, ...args })
    const id: unknown =
      typeof result === 'object' && result !== null ? Reflect.get(result, 'id') : null
    if (typeof id !== 'string') {
      throw new Error('spawn returned no pty id')
    }
    const env: Record<string, string> = spawnMock.mock.calls.at(-1)?.[2]?.env
    return { id, env }
  }

  it('leaves a real Claude launch on the managed account gate', async () => {
    prepareDeepSeekLaunchMock.mockReset()
    const prepareClaudeAuth = managedClaudeAuth()
    const { id, env } = await spawn(prepareClaudeAuth, { command: 'claude', launchAgent: 'claude' })
    expect(prepareClaudeAuth).toHaveBeenCalledTimes(1)
    expect(prepareDeepSeekLaunchMock).not.toHaveBeenCalled()
    expect(env.CLAUDE_CONFIG_DIR).toBe('/home/me/.dolphin/claude-accounts/a1')
    expect(env[DEEPSEEK_PROVIDER_ENV_KEY]).toBeUndefined()
    expect(hasLiveClaudePtys()).toBe(true)
    await handlers.get('pty:kill')!(null, { id })
  })

  it('still refuses a real Claude launch that carries conflicting auth env', async () => {
    await expect(
      spawn(managedClaudeAuth(), {
        command: 'claude',
        launchAgent: 'claude',
        env: { ANTHROPIC_API_KEY: 'sk-other' }
      })
    ).rejects.toThrow()
  })

  it('injects the DeepSeek env and skips the Claude account gate', async () => {
    prepareDeepSeekLaunchMock.mockReset()
    prepareDeepSeekLaunchMock.mockResolvedValue(DEEPSEEK_ENV)
    expect(hasLiveClaudePtys()).toBe(false)
    const prepareClaudeAuth = managedClaudeAuth()
    const { id, env } = await spawn(prepareClaudeAuth, {
      command: 'claude',
      launchAgent: 'deepseek',
      // Would trip the managed-account auth conflict check on a Claude launch.
      env: { ANTHROPIC_API_KEY: 'sk-other' }
    })
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
    expect(prepareDeepSeekLaunchMock).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: undefined })
    )
    expect(env).toMatchObject(DEEPSEEK_ENV)
    expect(hasLiveClaudePtys()).toBe(false)
    await handlers.get('pty:kill')!(null, { id })
  })

  it('treats a marked teammate pane as DeepSeek without a launch agent', async () => {
    prepareDeepSeekLaunchMock.mockReset()
    prepareDeepSeekLaunchMock.mockResolvedValue(DEEPSEEK_ENV)
    const prepareClaudeAuth = managedClaudeAuth()
    const { env } = await spawn(prepareClaudeAuth, {
      command: "cd '/repo' && env CLAUDECODE=1 '/usr/bin/claude' --agent-id a",
      env: { [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek' }
    })
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('sk-deepseek')
  })

  it('surfaces the missing-key error instead of starting Claude', async () => {
    prepareDeepSeekLaunchMock.mockReset()
    prepareDeepSeekLaunchMock.mockRejectedValue(new Error('DeepSeek has no API key.'))
    spawnMock.mockClear()
    await expect(
      spawn(managedClaudeAuth(), { command: 'claude', launchAgent: 'deepseek' })
    ).rejects.toThrow('DeepSeek has no API key.')
  })
})
