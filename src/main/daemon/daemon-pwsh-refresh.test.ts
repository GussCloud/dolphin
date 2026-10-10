import './mock-descendant-sweep'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DaemonPtyAdapter } from './daemon-pty-adapter'
import { DaemonRequestRouter } from './daemon-request-router'
import { DaemonServer } from './daemon-server'
import { getDaemonSocketPath } from './daemon-spawner'
import type { SubprocessHandle } from './session-subprocess-handle'
import type * as PwshModule from '../pwsh'

const { refreshPwshMock } = vi.hoisted(() => ({ refreshPwshMock: vi.fn() }))

vi.mock('../pwsh', async (importOriginal) => ({
  ...(await importOriginal<typeof PwshModule>()),
  refreshPwshAvailability: refreshPwshMock
}))

function createMockSubprocess(): SubprocessHandle {
  return {
    pid: 55556,
    getForegroundProcess: vi.fn(() => null),
    confirmForegroundProcess: vi.fn(async () => null),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    terminateOwnedTree: () => 'unavailable' as const,
    forceKill: vi.fn(),
    signal: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
    dispose: vi.fn()
  }
}

describe('daemon refreshPwshAvailability request', () => {
  let dir: string
  let server: DaemonServer
  let adapter: DaemonPtyAdapter

  beforeEach(async () => {
    refreshPwshMock.mockReset()
    dir = mkdtempSync(join(tmpdir(), 'daemon-pwsh-refresh-test-'))
    server = new DaemonServer({
      socketPath: getDaemonSocketPath(dir),
      tokenPath: join(dir, 'test.token'),
      spawnSubprocess: () => createMockSubprocess()
    })
    await server.start()
    adapter = new DaemonPtyAdapter({
      socketPath: getDaemonSocketPath(dir),
      tokenPath: join(dir, 'test.token')
    })
  })

  afterEach(async () => {
    adapter.dispose()
    await server.shutdown()
    rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('makes the daemon drop its cached pwsh answer and re-probe', async () => {
    refreshPwshMock.mockResolvedValue(true)
    await expect(adapter.refreshPwshAvailability()).resolves.toBe(true)
    expect(refreshPwshMock).toHaveBeenCalledTimes(1)
  })

  it('treats a daemon older than the request as unavailable instead of failing', async () => {
    const route = DaemonRequestRouter.prototype.route
    vi.spyOn(DaemonRequestRouter.prototype, 'route').mockImplementation(async function (
      this: DaemonRequestRouter,
      clientId,
      request
    ) {
      if (request.type === 'refreshPwshAvailability') {
        throw new Error('Unknown request type: refreshPwshAvailability')
      }
      return route.call(this, clientId, request)
    })
    await expect(adapter.refreshPwshAvailability()).resolves.toBeNull()
    expect(refreshPwshMock).not.toHaveBeenCalled()
  })
})
