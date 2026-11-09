import { describe, expect, it, vi } from 'vitest'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import {
  type DaemonSpawnCall,
  createDaemonActiveProviderFixtures
} from './pty-ipc-daemon-provider-fixtures'
import type { TuiAgent } from '../../shared/tui-agent'
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

// Why: every spawn route (renderer IPC and runtime RPC) must hand the owning worktree to
// CODEX_HOME resolution, or a worktree-pinned account silently launches as the active one.
const PINNED_HOME = '/data/codex-accounts/acct-pinned/home'
const ACTIVE_HOME = '/data/codex-accounts/acct-active/home'
const WORKSPACE = '/repo/worktrees/pinned'
const PINNED_WORKTREE_ID = `repo-id::${WORKSPACE}`

function resolveHomeByWorktree(
  _target?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null },
  _launchEnv?: NodeJS.ProcessEnv,
  launchContext?: { worktreeId?: string; launchAgent?: TuiAgent }
): string {
  return launchContext?.worktreeId === PINNED_WORKTREE_ID ? PINNED_HOME : ACTIVE_HOME
}

describe('worktree-pinned Codex account on spawn', () => {
  const { handlers, mainWindow } = setupPtyIpcSuite()
  const { setupDaemonAdapter, daemonSpawnAndGetOptions } = createDaemonActiveProviderFixtures({
    handlers,
    mainWindow
  })

  it('renderer IPC spawn injects the pinned worktree account as CODEX_HOME', async () => {
    const options = await daemonSpawnAndGetOptions(
      {},
      resolveHomeByWorktree,
      undefined,
      undefined,
      {
        cwd: WORKSPACE,
        worktreeId: PINNED_WORKTREE_ID,
        command: 'codex',
        launchAgent: 'codex'
      }
    )
    expect(options.env.CODEX_HOME).toBe(PINNED_HOME)
  })

  it('renderer IPC spawn without a worktree keeps the active account', async () => {
    const options = await daemonSpawnAndGetOptions(
      {},
      resolveHomeByWorktree,
      undefined,
      undefined,
      {
        cwd: WORKSPACE,
        command: 'codex',
        launchAgent: 'codex'
      }
    )
    expect(options.env.CODEX_HOME).toBe(ACTIVE_HOME)
  })

  it('runtime-created spawn injects the pinned worktree account as CODEX_HOME', async () => {
    type RuntimeSpawnController = {
      spawn(args: {
        cols: number
        rows: number
        cwd: string
        worktreeId: string
        command: string
        launchAgent: 'codex'
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
    registerPtyHandlers(mainWindow as never, runtime as never, resolveHomeByWorktree)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registration hands setPtyController the runtime spawn controller.
    const controller = runtime.setPtyController.mock.calls[0]?.[0] as RuntimeSpawnController

    await controller.spawn({
      cols: 80,
      rows: 24,
      cwd: WORKSPACE,
      worktreeId: PINNED_WORKTREE_ID,
      command: 'codex',
      launchAgent: 'codex'
    })

    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the daemon adapter mock records DaemonSpawnCall arguments.
    const spawnOptions = daemonSpawn.mock.calls.at(-1)?.[0] as DaemonSpawnCall
    expect(spawnOptions.env.CODEX_HOME).toBe(PINNED_HOME)
  })
})
