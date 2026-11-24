import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const processMocks = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('node:child_process', () => ({ fork: processMocks.fork }))

import { PLUGIN_WORKER_MAX_OLD_SPACE_MB, startPluginWorker } from './plugin-host-process'

class FakeChild extends EventEmitter {
  connected = true
  stdout = new PassThrough()
  stderr = new PassThrough()
  send = vi.fn()
  kill = vi.fn()
}

function start(child: FakeChild, options: { eventTimeoutMs?: number } = {}) {
  processMocks.fork.mockReturnValue(child)
  return startPluginWorker({
    pluginId: 'dolphin-samples.demo',
    rootDir: '/plugin',
    mainEntry: 'worker.js',
    entryPath: '/host.js',
    grantedCapabilities: [],
    executeHostCall: async () => ({ ok: true, value: null }),
    log: vi.fn(),
    ...options
  })
}

beforeEach(() => {
  processMocks.fork.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startPluginWorker', () => {
  it('runs with only its own heap ceiling, never Dolphin execArgv', async () => {
    const child = new FakeChild()
    const pending = start(child)
    child.emit('message', { type: 'ready', commands: [] })
    await pending

    expect(processMocks.fork).toHaveBeenCalledWith(
      '/host.js',
      [],
      expect.objectContaining({
        execArgv: [`--max-old-space-size=${PLUGIN_WORKER_MAX_OLD_SPACE_MB}`]
      })
    )
  })

  it('reports a heap-limit abort as this worker exiting, with the fatal line in its log', async () => {
    const child = new FakeChild()
    const log = vi.fn()
    processMocks.fork.mockReturnValue(child)
    const pending = startPluginWorker({
      pluginId: 'dolphin-samples.demo',
      rootDir: '/plugin',
      mainEntry: 'worker.js',
      entryPath: '/host.js',
      grantedCapabilities: [],
      executeHostCall: async () => ({ ok: true, value: null }),
      log
    })
    child.emit('message', { type: 'ready', commands: ['run'] })
    const handle = await pending
    const onExit = vi.fn()
    handle.onExit(onExit)
    const command = handle.invokeCommand('run')

    child.stderr.write(
      'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n'
    )
    child.emit('exit', null, 'SIGABRT')

    await expect(command).rejects.toThrow('worker exited before responding')
    expect(onExit).toHaveBeenCalledWith(null)
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith('error', expect.stringContaining('heap out of memory'))
    )
  })

  it('replays an exit that happened before handle registration', async () => {
    const child = new FakeChild()
    const pending = start(child)
    child.emit('message', { type: 'ready', commands: ['run'] })
    const handle = await pending
    child.emit('exit', 23)
    const onExit = vi.fn()

    handle.onExit(onExit)

    expect(onExit).toHaveBeenCalledOnce()
    expect(onExit).toHaveBeenCalledWith(23)
  })

  it('kills a live worker that disconnects its IPC channel', async () => {
    const child = new FakeChild()
    const pending = start(child)
    child.emit('message', { type: 'ready', commands: ['run'] })
    const handle = await pending
    const command = handle.invokeCommand('run')
    child.connected = false

    child.emit('disconnect')

    await expect(command).rejects.toThrow('disconnected')
    expect(child.kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('counts delivered events as in flight until their acknowledgement', async () => {
    const child = new FakeChild()
    const pending = start(child)
    child.emit('message', { type: 'ready', commands: [] })
    const handle = await pending

    handle.deliverEvent('worktree.created', {
      worktreeId: 'worktree-1',
      path: '/repo',
      branch: 'feature'
    })

    expect(handle.inFlightCount()).toBe(1)
    child.emit('message', { type: 'eventAck', eventId: 0 })
    expect(handle.inFlightCount()).toBe(0)
  })

  it('kills a worker whose event handler never acknowledges completion', async () => {
    vi.useFakeTimers()
    const child = new FakeChild()
    const pending = start(child, { eventTimeoutMs: 25 })
    child.emit('message', { type: 'ready', commands: [] })
    const handle = await pending

    handle.deliverEvent('worktree.created', {
      worktreeId: 'worktree-1',
      path: '/repo',
      branch: 'feature'
    })
    await vi.advanceTimersByTimeAsync(25)

    expect(handle.inFlightCount()).toBe(0)
    expect(child.kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('kills a worker that exceeds the pending event cap', async () => {
    const child = new FakeChild()
    const pending = start(child)
    child.emit('message', { type: 'ready', commands: [] })
    const handle = await pending

    for (let index = 0; index < 65; index += 1) {
      handle.deliverEvent('agent.status.changed', {
        worktreeId: null,
        paneKey: `pane-${index}`,
        state: 'working',
        receivedAt: Date.now()
      })
    }

    expect(handle.inFlightCount()).toBe(64)
    expect(child.kill).toHaveBeenCalledWith('SIGKILL')
  })
})
