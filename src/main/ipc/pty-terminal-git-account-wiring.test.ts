import { describe, expect, it, vi } from 'vitest'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import { createDaemonActiveProviderFixtures } from './pty-ipc-daemon-provider-fixtures'
import { registerPtyHandlers } from './pty'

const accountMock = vi.hoisted(() => ({
  apply: vi.fn(async (env: Record<string, string>, spawn: { connectionId?: string | null }) => {
    if (!spawn.connectionId) {
      env.GIT_CONFIG_PARAMETERS = "'user.email=project@corp.example'"
    }
  })
}))
vi.mock('../pty/terminal-git-account-env', () => ({
  applyTerminalGitAccountForSpawn: accountMock.apply
}))
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

// Why one file for three paths: each host-local spawn path assembles its own env, so each must apply the project account.
describe('project git account in new terminals', () => {
  const { handlers, mainWindow, spawnAndGetEnv } = setupPtyIpcSuite()
  const { setupDaemonAdapter, daemonSpawnAndGetEnv } = createDaemonActiveProviderFixtures({
    handlers,
    mainWindow
  })

  it('reaches a renderer terminal on the local provider', async () => {
    accountMock.apply.mockClear()
    const env = await spawnAndGetEnv()
    expect(env.GIT_CONFIG_PARAMETERS).toBe("'user.email=project@corp.example'")
  })

  it('reaches a renderer terminal on the daemon', async () => {
    accountMock.apply.mockClear()
    setupDaemonAdapter()
    const env = await daemonSpawnAndGetEnv()
    expect(env.GIT_CONFIG_PARAMETERS).toBe("'user.email=project@corp.example'")
  })

  it('reaches a runtime-created terminal (agents, teammate panes) on the daemon', async () => {
    accountMock.apply.mockClear()
    const daemonSpawn = setupDaemonAdapter()
    const runtime = {
      setPtyController: vi.fn(),
      registerPty: vi.fn(),
      onPtySpawned: vi.fn(),
      onPtyExit: vi.fn(),
      onPtyData: vi.fn()
    }
    handlers.clear()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial test doubles, as in the sibling PTY spawn suites.
    registerPtyHandlers(mainWindow as never, runtime as never)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registerPtyHandlers hands the runtime its PTY controller.
    const controller = runtime.setPtyController.mock.calls[0]?.[0] as {
      spawn(args: { cols: number; rows: number; worktreeId?: string }): Promise<{ id: string }>
    }
    await controller.spawn({ cols: 80, rows: 24, worktreeId: 'repo-1::/work/wt' })
    expect(accountMock.apply).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ worktreeId: 'repo-1::/work/wt' })
    )
    expect(daemonSpawn.mock.calls.at(-1)?.[0].env?.GIT_CONFIG_PARAMETERS).toBe(
      "'user.email=project@corp.example'"
    )
  })
})
