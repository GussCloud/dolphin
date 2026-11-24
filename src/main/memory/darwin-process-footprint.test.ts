import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NodeFs from 'node:fs'
import os from 'node:os'

const { runProcessMock, existsSyncMock } = vi.hoisted(() => ({
  runProcessMock: vi.fn(),
  existsSyncMock: vi.fn<(path: string) => boolean>()
}))

vi.mock('../../shared/child-process/run-process', () => ({
  runProcess: (spec: unknown) => runProcessMock(spec)
}))

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof NodeFs>()),
  existsSync: (path: string) => existsSyncMock(path)
}))

async function loadReader() {
  vi.resetModules()
  return await import('./darwin-process-footprint')
}

function helperResult(stdout: string, overrides: Record<string, unknown> = {}) {
  return { code: 0, signal: null, stdout, stderr: '', timedOut: false, ...overrides }
}

function enoent(): Error {
  return Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
}

describe('parseProcessFootprintOutput', () => {
  it('parses pid/byte pairs and skips malformed lines', async () => {
    const { parseProcessFootprintOutput } = await loadReader()

    const parsed = parseProcessFootprintOutput(
      ['71119 2818480', '', 'abc 12', '0 5', '-3 5', '42 -1', '42', '7 9007199254740000'].join('\n')
    )

    expect([...parsed]).toEqual([
      [71119, 2818480],
      [7, 9007199254740000]
    ])
  })
})

describe('readDarwinProcessFootprints', () => {
  let now = 0

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(os, 'platform').mockReturnValue('darwin')
    now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    runProcessMock.mockReset()
    existsSyncMock.mockReset()
    existsSyncMock.mockImplementation((path) => path.endsWith('dolphin-process-footprint'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null off macOS without spawning', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux')
    const { readDarwinProcessFootprints } = await loadReader()

    expect(await readDarwinProcessFootprints()).toBeNull()
    expect(runProcessMock).not.toHaveBeenCalled()
  })

  it('reads every pid with no arguments, bounded by a timeout and an output cap', async () => {
    runProcessMock.mockResolvedValue(helperResult('10 100\n20 200\n'))
    const { readDarwinProcessFootprints } = await loadReader()

    const footprints = await readDarwinProcessFootprints()

    expect(footprints && [...footprints]).toEqual([
      [10, 100],
      [20, 200]
    ])
    const spec = runProcessMock.mock.calls[0][0]
    expect(spec.program).toMatch(/dolphin-process-footprint$/)
    expect(spec.args).toEqual([])
    expect(spec.timeoutMs).toBeGreaterThan(0)
    expect(spec.maxOutputBytes).toBeGreaterThan(0)
  })

  it('passes requested pids through and never turns an empty request into "all"', async () => {
    runProcessMock.mockResolvedValue(helperResult('10 100\n'))
    const { readDarwinProcessFootprints } = await loadReader()

    await readDarwinProcessFootprints([10, -1, 1.5, 20])
    const empty = await readDarwinProcessFootprints([])

    expect(runProcessMock).toHaveBeenCalledTimes(1)
    expect(runProcessMock.mock.calls[0][0].args).toEqual(['10', '20'])
    expect(empty?.size).toBe(0)
  })

  it('disables itself for good when the helper is not bundled', async () => {
    existsSyncMock.mockReturnValue(false)
    const { readDarwinProcessFootprints } = await loadReader()

    expect(await readDarwinProcessFootprints()).toBeNull()
    now += 10 * 60_000
    expect(await readDarwinProcessFootprints()).toBeNull()
    expect(runProcessMock).not.toHaveBeenCalled()
    expect(existsSyncMock).toHaveBeenCalledTimes(1)
  })

  it('disables itself for good when the helper vanishes (ENOENT)', async () => {
    runProcessMock.mockRejectedValue(enoent())
    const { readDarwinProcessFootprints } = await loadReader()

    expect(await readDarwinProcessFootprints()).toBeNull()
    now += 10 * 60_000
    expect(await readDarwinProcessFootprints()).toBeNull()
    expect(runProcessMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a timeout', helperResult('', { code: null, signal: 'SIGTERM', timedOut: true })],
    ['a bad exit', helperResult('', { code: 1 })],
    ['truncated output', helperResult('10 100\n', { outputTruncated: true })]
  ])('backs off after %s and retries later instead of disabling', async (_label, failure) => {
    runProcessMock.mockResolvedValueOnce(failure)
    runProcessMock.mockResolvedValue(helperResult('10 100\n'))
    const { readDarwinProcessFootprints } = await loadReader()

    expect(await readDarwinProcessFootprints()).toBeNull()
    // Inside the backoff window: no new spawn.
    now += 1_000
    expect(await readDarwinProcessFootprints()).toBeNull()
    expect(runProcessMock).toHaveBeenCalledTimes(1)

    now += 60_000
    const recovered = await readDarwinProcessFootprints()
    expect(recovered?.get(10)).toBe(100)
    expect(runProcessMock).toHaveBeenCalledTimes(2)
  })

  it('retries after a spawn error other than ENOENT', async () => {
    runProcessMock.mockRejectedValueOnce(Object.assign(new Error('EAGAIN'), { code: 'EAGAIN' }))
    runProcessMock.mockResolvedValue(helperResult('10 100\n'))
    const { readDarwinProcessFootprints } = await loadReader()

    expect(await readDarwinProcessFootprints()).toBeNull()
    now += 60_000
    expect((await readDarwinProcessFootprints())?.get(10)).toBe(100)
  })
})
