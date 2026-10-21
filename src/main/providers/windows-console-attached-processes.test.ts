/*
 * Coverage for the pooled console-attachment reader.
 *
 * The forking reader caused #10857; these assertions keep its contract -- the
 * bounded timeout, spawn errors, malformed messages and helper-pid removal --
 * and add the pool's: one helper reused across requests, serialized requests,
 * restart with backoff after a crash, and idle shutdown.
 */
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWindowsConsoleListClient,
  type WindowsConsoleListClientDeps
} from './windows-console-attached-processes'

type Request = { id: number; shellPid: number }

class FakeHelper extends EventEmitter {
  connected = true
  readonly sent: Request[] = []
  readonly kill = vi.fn(() => {
    this.connected = false
    return true
  })
  readonly unref = vi.fn()
  constructor(readonly pid: number | undefined) {
    super()
  }
  send(message: Request): boolean {
    this.sent.push(message)
    return true
  }
  reply(list: unknown, id = this.sent.at(-1)?.id): void {
    this.emit('message', { id, consoleProcessList: list })
  }
  crash(): void {
    this.connected = false
    this.emit('exit', 1, null)
  }
}

function setup(overrides: WindowsConsoleListClientDeps = {}, pids: (number | undefined)[] = []) {
  const helpers: FakeHelper[] = []
  let nextPid = 999
  const forkHelper = vi.fn((_path: string, _args: readonly string[]) => {
    const helper = new FakeHelper(pids.length > 0 ? pids.shift() : nextPid++)
    helpers.push(helper)
    return helper
  })
  const client = createWindowsConsoleListClient({
    forkHelper,
    resolveAgentPath: () => '/fixed/node-pty/conpty_console_list_agent.js',
    timeoutMs: 100,
    idleMs: 1_000,
    restartBackoffMs: 50,
    ...overrides
  })
  return { client, forkHelper, helpers }
}

describe('createWindowsConsoleListClient', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns exact console membership from the node-pty helper in serve mode', async () => {
    const { client, forkHelper, helpers } = setup()
    const result = client.read(101)
    expect(forkHelper).toHaveBeenCalledWith('/fixed/node-pty/conpty_console_list_agent.js', [
      '--serve'
    ])
    expect(helpers[0].sent).toEqual([{ id: 1, shellPid: 101 }])
    helpers[0].reply([999, 101, 202, 303])
    await expect(result).resolves.toEqual(new Set([101, 202, 303]))
    expect(helpers[0].unref).toHaveBeenCalled()
    client.dispose()
  })

  it.each([
    ['root-only failure fallback', [101], 999],
    ['malformed response', [999, 101, '202'], 999],
    ['missing PTY root', [999, 202, 303], 999],
    ['missing helper pid', [101, 202], 999],
    ['unavailable helper pid', [101, 202], undefined]
  ])('fails closed for %s', async (_label, processIds, helperPid) => {
    const { client, helpers } = setup({}, [helperPid])
    const result = client.read(101)
    helpers[0].reply(processIds)
    await expect(result).resolves.toBeNull()
    client.dispose()
  })

  it('returns root-only membership when only the helper and shell are attached', async () => {
    const { client, helpers } = setup()
    const result = client.read(101)
    helpers[0].reply([999, 101])
    await expect(result).resolves.toEqual(new Set([101]))
    client.dispose()
  })

  it('rejects invalid root pids without starting a helper', async () => {
    const { client, forkHelper } = setup()
    await expect(client.read(0)).resolves.toBeNull()
    await expect(client.read(Number.NaN)).resolves.toBeNull()
    expect(forkHelper).not.toHaveBeenCalled()
  })

  it('reuses one helper and serializes concurrent requests', async () => {
    const { client, forkHelper, helpers } = setup()
    const first = client.read(101)
    const second = client.read(202)
    expect(helpers[0].sent).toEqual([{ id: 1, shellPid: 101 }])

    helpers[0].reply([999, 101, 111])
    await expect(first).resolves.toEqual(new Set([101, 111]))
    expect(helpers[0].sent).toEqual([
      { id: 1, shellPid: 101 },
      { id: 2, shellPid: 202 }
    ])
    // A stale id must not settle the in-flight request.
    helpers[0].reply([999, 101], 1)
    helpers[0].reply([999, 202])
    await expect(second).resolves.toEqual(new Set([202]))
    expect(forkHelper).toHaveBeenCalledTimes(1)
    client.dispose()
  })

  it('kills a silent helper at the timeout and drops queued requests past their deadline', async () => {
    const { client, forkHelper, helpers } = setup()
    const first = client.read(101)
    const second = client.read(202)
    await vi.advanceTimersByTimeAsync(100)
    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBeNull()
    expect(helpers[0].kill).toHaveBeenCalledTimes(1)
    // The queued request fails closed during restart backoff instead of forking again.
    expect(forkHelper).toHaveBeenCalledTimes(1)
    client.dispose()
  })

  it('restarts after a crash, failing closed while backing off', async () => {
    const { client, forkHelper, helpers } = setup()
    const first = client.read(101)
    helpers[0].crash()
    await expect(first).resolves.toBeNull()

    await expect(client.read(101)).resolves.toBeNull()
    expect(forkHelper).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(50)
    const retried = client.read(101)
    expect(forkHelper).toHaveBeenCalledTimes(2)
    helpers[1].reply([1000, 101])
    await expect(retried).resolves.toEqual(new Set([101]))
    client.dispose()
  })

  it('doubles the restart backoff on repeated crashes', async () => {
    const { client, forkHelper, helpers } = setup()
    const first = client.read(101)
    helpers[0].crash()
    await first
    await vi.advanceTimersByTimeAsync(50)
    const second = client.read(101)
    helpers[1].crash()
    await second

    await vi.advanceTimersByTimeAsync(50)
    await expect(client.read(101)).resolves.toBeNull()
    expect(forkHelper).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(50)
    void client.read(101)
    expect(forkHelper).toHaveBeenCalledTimes(3)
    client.dispose()
  })

  it('handles helper spawn errors without an unhandled child error', async () => {
    const { client, helpers } = setup()
    const result = client.read(101)
    helpers[0].emit('error', new Error('spawn failed'))
    await expect(result).resolves.toBeNull()
    // Late teardown errors from the dead helper are absorbed.
    expect(() => helpers[0].emit('error', new Error('kill failed'))).not.toThrow()
    client.dispose()
  })

  it('fails closed when the fork itself throws', async () => {
    const { client } = setup({
      forkHelper: () => {
        throw new Error('EAGAIN')
      }
    })
    await expect(client.read(101)).resolves.toBeNull()
  })

  it('shuts an idle helper down and starts a fresh one on the next request', async () => {
    const { client, forkHelper, helpers } = setup()
    const first = client.read(101)
    helpers[0].reply([999, 101])
    await first

    await vi.advanceTimersByTimeAsync(999)
    expect(helpers[0].kill).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(helpers[0].kill).toHaveBeenCalledTimes(1)

    // Idle shutdown is not a failure, so no backoff applies.
    const next = client.read(101)
    expect(forkHelper).toHaveBeenCalledTimes(2)
    helpers[1].reply([1000, 101])
    await expect(next).resolves.toEqual(new Set([101]))
    client.dispose()
  })

  it('settles pending requests and kills the helper on dispose', async () => {
    const { client, helpers } = setup()
    const first = client.read(101)
    const second = client.read(202)
    client.dispose()
    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBeNull()
    expect(helpers[0].kill).toHaveBeenCalledTimes(1)
  })
})
