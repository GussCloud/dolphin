import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { spawnMock } from './pty-ipc-mock-registry'
import { makeDisposable } from './pty-ipc-test-constants'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import { DEEPSEEK_PROVIDER_ENV_KEY } from '../../shared/deepseek-claude-provider'
import { CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV } from '../claude/claude-dangerous-rm-prompt-env'
import { registerPtyHandlers, registerSshPtyProvider } from './pty'

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

const NO_TIMEOUT = CLAUDE_DANGEROUS_RM_NO_TIMEOUT_ENV

describe('Claude dangerous-rm no-timeout env on PTY spawn', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()

  async function spawnLocal(args: Record<string, unknown>): Promise<Record<string, string>> {
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
    const prepareClaudeAuth = vi.fn(async () => ({
      configDir: '/home/me/.dolphin/claude-accounts/a1',
      envPatch: { CLAUDE_CONFIG_DIR: '/home/me/.dolphin/claude-accounts/a1' },
      stripAuthEnv: false,
      provenance: 'managed:a1'
    }))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the shared pty IPC harness window implements only the webContents calls spawn uses.
    registerPtyHandlers(mainWindow as never, undefined, undefined, undefined, prepareClaudeAuth)
    const result: unknown = await handlers.get('pty:spawn')?.(null, { cols: 80, rows: 24, ...args })
    const id = z.object({ id: z.string() }).safeParse(result).data?.id
    if (typeof id !== 'string') {
      throw new Error('spawn returned no pty id')
    }
    const env: Record<string, string> = spawnMock.mock.calls.at(-1)?.[2]?.env
    await handlers.get('pty:kill')!(null, { id })
    return env
  }

  it('gives a Claude launch the no-timeout env', async () => {
    expect((await spawnLocal({ command: 'claude', launchAgent: 'claude' }))[NO_TIMEOUT]).toBe('1')
  })

  it('gives an Agent Teams teammate pane command the no-timeout env', async () => {
    const env = await spawnLocal({
      command: "cd '/repo' && env CLAUDECODE=1 '/usr/bin/claude' --agent-id a"
    })
    expect(env[NO_TIMEOUT]).toBe('1')
  })

  it('gives a DeepSeek launch the no-timeout env', async () => {
    prepareDeepSeekLaunchMock.mockReset()
    prepareDeepSeekLaunchMock.mockResolvedValue({ [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek' })
    const env = await spawnLocal({ command: 'claude', launchAgent: 'deepseek' })
    expect(env[NO_TIMEOUT]).toBe('1')
  })

  it("keeps the user's own value", async () => {
    const env = await spawnLocal({
      command: 'claude',
      launchAgent: 'claude',
      env: { [NO_TIMEOUT]: '0' }
    })
    expect(env[NO_TIMEOUT]).toBe('0')
  })

  it('leaves other agents and plain shells alone', async () => {
    expect(
      (await spawnLocal({ command: 'codex', launchAgent: 'codex' }))[NO_TIMEOUT]
    ).toBeUndefined()
    expect((await spawnLocal({}))[NO_TIMEOUT]).toBeUndefined()
  })

  it.each([
    ['the default', undefined, '1'],
    ["this process's own value", '0', '0']
  ])('sends %s to an SSH host', async (_label, inherited, expected) => {
    const previous = process.env[NO_TIMEOUT]
    if (inherited === undefined) {
      delete process.env[NO_TIMEOUT]
    } else {
      process.env[NO_TIMEOUT] = inherited
    }
    const sshSpawn = vi.fn(async (_options: { env?: Record<string, string> }) => ({
      id: 'remote-pty'
    }))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: spawn is the only provider call this test reaches.
    registerSshPtyProvider('ssh-rm', {
      spawn: sshSpawn,
      write: vi.fn(),
      resize: vi.fn(),
      shutdown: vi.fn(),
      sendSignal: vi.fn(),
      getCwd: vi.fn(),
      getInitialCwd: vi.fn(),
      clearBuffer: vi.fn(),
      acknowledgeDataEvent: vi.fn(),
      hasChildProcesses: vi.fn(),
      getForegroundProcess: vi.fn(),
      serialize: vi.fn(),
      revive: vi.fn(),
      onData: vi.fn(() => () => {}),
      onReplay: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      listProcesses: vi.fn(async () => []),
      attach: vi.fn(),
      getDefaultShell: vi.fn(),
      getProfiles: vi.fn()
    } as never)
    handlers.clear()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the shared pty IPC harness window implements only the webContents calls spawn uses.
    registerPtyHandlers(mainWindow as never)
    // Only the env handed to the SSH provider matters; later relay bookkeeping is out of scope.
    await Promise.resolve(
      handlers.get('pty:spawn')?.(null, {
        cols: 80,
        rows: 24,
        connectionId: 'ssh-rm',
        command: 'claude',
        launchAgent: 'claude',
        env: {}
      })
    ).catch(() => {})
    if (previous === undefined) {
      delete process.env[NO_TIMEOUT]
    } else {
      process.env[NO_TIMEOUT] = previous
    }
    expect(sshSpawn).toHaveBeenCalled()
    expect(sshSpawn.mock.calls[0]?.[0]?.env?.[NO_TIMEOUT]).toBe(expected)
  })
})
