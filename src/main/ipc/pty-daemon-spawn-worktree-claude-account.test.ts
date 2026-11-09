import { describe, expect, it, vi } from 'vitest'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import {
  type DaemonSpawnCall,
  createDaemonActiveProviderFixtures
} from './pty-ipc-daemon-provider-fixtures'
import { registerPtyHandlers } from './pty'

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
vi.mock('../claude-accounts/live-pty-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../claude-accounts/live-pty-gate')>()), // eslint-disable-line @typescript-eslint/consistent-type-imports -- importOriginal needs the module type
  isClaudeAuthSwitchInProgress: () => false
}))

// Why: every spawn route (renderer IPC and runtime RPC) must hand the owning worktree to Claude
// auth preparation, or a worktree-pinned account silently launches as the active one.
const PINNED_CONFIG_DIR = '/data/claude-accounts/acct-pinned/config'
const WORKSPACE = '/repo/worktrees/pinned'
const PINNED_WORKTREE_ID = `repo-id::${WORKSPACE}`

const prepareClaudeAuth = vi.fn(
  async (
    _target?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null },
    launch?: { worktreeId?: string; workspacePath?: string }
  ) =>
    launch?.worktreeId === PINNED_WORKTREE_ID
      ? {
          configDir: PINNED_CONFIG_DIR,
          envPatch: { CLAUDE_CONFIG_DIR: PINNED_CONFIG_DIR },
          stripAuthEnv: true,
          provenance: 'managed:acct-pinned:pinned'
        }
      : { configDir: '/home/u/.claude', envPatch: {}, stripAuthEnv: false, provenance: 'system' }
)

describe('worktree-pinned Claude account on spawn', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()
  const { setupDaemonAdapter } = createDaemonActiveProviderFixtures({ handlers, mainWindow })

  it('renderer IPC spawn launches Claude on the pinned account config dir', async () => {
    const daemonSpawn = setupDaemonAdapter()
    handlers.clear()
    registerPtyHandlers(mainWindow as never, undefined, undefined, undefined, prepareClaudeAuth)

    await handlers.get('pty:spawn')!(null, {
      cols: 80,
      rows: 24,
      cwd: WORKSPACE,
      worktreeId: PINNED_WORKTREE_ID,
      command: 'claude',
      launchAgent: 'claude'
    })

    expect(prepareClaudeAuth).toHaveBeenLastCalledWith(expect.anything(), {
      worktreeId: PINNED_WORKTREE_ID,
      workspacePath: WORKSPACE
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the daemon adapter mock records DaemonSpawnCall arguments.
    const spawnOptions = daemonSpawn.mock.calls.at(-1)?.[0] as DaemonSpawnCall
    expect(spawnOptions.env.CLAUDE_CONFIG_DIR).toBe(PINNED_CONFIG_DIR)
  })

  it('runtime-created spawn launches Claude on the pinned account config dir', async () => {
    type RuntimeSpawnController = {
      spawn(args: {
        cols: number
        rows: number
        cwd: string
        worktreeId: string
        command: string
        launchAgent: 'claude'
      }): Promise<{ id: string }>
    }
    const daemonSpawn = setupDaemonAdapter()
    const runtime = {
      setPtyController: vi.fn(),
      registerPty: vi.fn(),
      noteTerminalSpawnCommand: vi.fn(),
      onPtySpawned: vi.fn(),
      onPtyExit: vi.fn(),
      onPtyData: vi.fn()
    }
    handlers.clear()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the suite's window and runtime stubs cover what registration calls.
    registerPtyHandlers(
      mainWindow as never,
      runtime as never,
      undefined,
      undefined,
      prepareClaudeAuth
    )
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registration hands setPtyController the runtime spawn controller.
    const controller = runtime.setPtyController.mock.calls[0]?.[0] as RuntimeSpawnController

    await controller.spawn({
      cols: 80,
      rows: 24,
      cwd: WORKSPACE,
      worktreeId: PINNED_WORKTREE_ID,
      command: 'claude',
      launchAgent: 'claude'
    })

    expect(prepareClaudeAuth).toHaveBeenLastCalledWith(expect.anything(), {
      worktreeId: PINNED_WORKTREE_ID,
      workspacePath: WORKSPACE
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the daemon adapter mock records DaemonSpawnCall arguments.
    const spawnOptions = daemonSpawn.mock.calls.at(-1)?.[0] as DaemonSpawnCall
    expect(spawnOptions.env.CLAUDE_CONFIG_DIR).toBe(PINNED_CONFIG_DIR)
  })

  it('a DeepSeek launch never goes through the Claude account gate', async () => {
    setupDaemonAdapter()
    prepareClaudeAuth.mockClear()
    handlers.clear()
    registerPtyHandlers(mainWindow as never, undefined, undefined, undefined, prepareClaudeAuth)

    await handlers.get('pty:spawn')!(null, {
      cols: 80,
      rows: 24,
      cwd: WORKSPACE,
      worktreeId: PINNED_WORKTREE_ID,
      command: 'claude',
      launchAgent: 'deepseek'
    }).catch(() => {})

    expect(prepareClaudeAuth).not.toHaveBeenCalled()
  })
})
