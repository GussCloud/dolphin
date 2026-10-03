import './mock-descendant-sweep'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as HeapHeartbeatModule from '../diagnostics/process-heap-heartbeat'
import type { ProcessHeapHeartbeatOptions } from '../diagnostics/process-heap-heartbeat'
import { DaemonClient } from './client'
import type { DaemonFileLog } from './daemon-file-log'
import { countLiveDaemonSessions, parseDaemonHeapUsage } from './daemon-heap-usage'
import { DaemonPtyAdapter } from './daemon-pty-adapter'
import { DaemonRequestRouter } from './daemon-request-router'
import { DaemonServer } from './daemon-server'
import { getDaemonSocketPath } from './daemon-spawner'
import type { SubprocessHandle } from './session-subprocess-handle'

const heartbeat = vi.hoisted(() => {
  const state: { options: ProcessHeapHeartbeatOptions | null; stop: () => void } = {
    options: null,
    stop: vi.fn()
  }
  return state
})
vi.mock('../diagnostics/process-heap-heartbeat', async (importOriginal) => ({
  ...(await importOriginal<typeof HeapHeartbeatModule>()),
  startProcessHeapHeartbeat: (options: ProcessHeapHeartbeatOptions) => {
    heartbeat.options = options
    return heartbeat.stop
  }
}))

const MB = 1024 * 1024
const heap = {
  rssBytes: 200 * MB,
  heapUsedBytes: 80 * MB,
  heapTotalBytes: 100 * MB,
  externalBytes: 4 * MB,
  arrayBuffersBytes: 1 * MB
}

function createMockSubprocess(): SubprocessHandle {
  return {
    pid: 55555,
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

describe('parseDaemonHeapUsage', () => {
  it('accepts a well-formed reply and rejects anything else', () => {
    expect(parseDaemonHeapUsage({ heap, liveSessionCount: 2 })).toEqual({
      heap,
      liveSessionCount: 2
    })
    expect(parseDaemonHeapUsage({ heap, liveSessionCount: -1 })).toBeNull()
    expect(parseDaemonHeapUsage({ heap: { rssBytes: 1 }, liveSessionCount: 0 })).toBeNull()
    expect(parseDaemonHeapUsage({ pong: true })).toBeNull()
    expect(parseDaemonHeapUsage(undefined)).toBeNull()
  })
})

describe('countLiveDaemonSessions', () => {
  it('counts only live sessions', () => {
    expect(
      countLiveDaemonSessions([{ isAlive: true }, { isAlive: false }, { isAlive: true }])
    ).toBe(2)
  })
})

describe('DaemonServer heap reporting', () => {
  let dir: string
  let server: DaemonServer
  let client: DaemonClient | undefined
  const log: DaemonFileLog = { log: vi.fn(), close: vi.fn() }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'daemon-heap-usage-test-'))
    server = new DaemonServer({
      socketPath: getDaemonSocketPath(dir),
      tokenPath: join(dir, 'test.token'),
      spawnSubprocess: () => createMockSubprocess(),
      log
    })
  })

  afterEach(async () => {
    client?.disconnect()
    await server.shutdown()
    rmSync(dir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('writes heartbeats to the daemon log with the live session count', () => {
    heartbeat.options?.emit({ heapUsedMb: 80 })
    expect(log.log).toHaveBeenCalledWith('heap-heartbeat', { heapUsedMb: 80 })
    expect(heartbeat.options?.readSessionCount?.()).toBe(0)
  })

  it('answers heapUsage with its own heap, and stops the heartbeat on shutdown', async () => {
    await server.start()
    client = new DaemonClient({
      socketPath: getDaemonSocketPath(dir),
      tokenPath: join(dir, 'test.token')
    })
    await client.ensureConnected()

    const reply = parseDaemonHeapUsage(await client.request('heapUsage', undefined))
    expect(reply?.liveSessionCount).toBe(0)
    expect(reply?.heap.heapUsedBytes).toBeGreaterThan(0)

    client.disconnect()
    client = undefined
    await server.shutdown()
    expect(heartbeat.stop).toHaveBeenCalled()
  })

  it('reads the heap through the adapter, and treats an older daemon as unavailable', async () => {
    await server.start()
    const adapter = new DaemonPtyAdapter({
      socketPath: getDaemonSocketPath(dir),
      tokenPath: join(dir, 'test.token')
    })
    try {
      expect((await adapter.readHeapUsage())?.liveSessionCount).toBe(0)

      const route = DaemonRequestRouter.prototype.route
      const olderDaemon = vi
        .spyOn(DaemonRequestRouter.prototype, 'route')
        .mockImplementation(async function (this: DaemonRequestRouter, clientId, request) {
          if (request.type === 'heapUsage') {
            throw new Error('Unknown request type: heapUsage')
          }
          return route.call(this, clientId, request)
        })
      await expect(adapter.readHeapUsage()).resolves.toBeNull()
      olderDaemon.mockRestore()
    } finally {
      adapter.dispose()
    }
  })
})
