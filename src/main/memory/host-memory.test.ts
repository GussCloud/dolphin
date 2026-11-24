import { beforeEach, describe, expect, it, vi } from 'vitest'
import os from 'node:os'

const { runProcessMock, readFileMock } = vi.hoisted(() => ({
  runProcessMock: vi.fn(),
  readFileMock: vi.fn()
}))

vi.mock('../../shared/child-process/run-process', () => ({
  runProcess: runProcessMock
}))

vi.mock('node:fs/promises', () => ({
  readFile: (file: string, encoding: string) => readFileMock(file, encoding)
}))

async function loadHostMemory() {
  vi.resetModules()
  return import('./host-memory')
}

describe('host memory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    runProcessMock.mockReset()
    readFileMock.mockReset()
    vi.spyOn(os, 'totalmem').mockReturnValue(1_000)
    vi.spyOn(os, 'freemem').mockReturnValue(100)
    vi.spyOn(os, 'cpus').mockReturnValue([{}, {}] as ReturnType<typeof os.cpus>)
    vi.spyOn(os, 'loadavg').mockReturnValue([1.5, 1, 0.5])
  })

  it('uses macOS memory-pressure availability instead of immediate free pages', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('darwin')
    runProcessMock.mockResolvedValue({
      code: 0,
      signal: null,
      stdout: 'System-wide memory free percentage: 79%',
      stderr: '',
      timedOut: false
    })
    const { collectHostMemory } = await loadHostMemory()

    const host = await collectHostMemory()

    expect(host).toMatchObject({
      totalMemory: 1_000,
      freeMemory: 100,
      availableMemory: 790,
      availableMemorySource: 'memory-pressure',
      usedMemory: 210,
      memoryUsagePercent: 21,
      cpuCoreCount: 2,
      loadAverage1m: 1.5
    })
    expect(runProcessMock).toHaveBeenCalledWith({
      program: '/usr/bin/memory_pressure',
      args: ['-Q'],
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
      maxOutputBytes: 64 * 1024,
      timeoutMs: 1_000
    })
  })

  it('retries macOS availability after a transient failure instead of disabling it', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('darwin')
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    runProcessMock.mockResolvedValueOnce({
      code: null,
      signal: 'SIGTERM',
      stdout: '',
      stderr: '',
      timedOut: true
    })
    runProcessMock.mockResolvedValue({
      code: 0,
      signal: null,
      stdout: 'System-wide memory free percentage: 47%',
      stderr: '',
      timedOut: false
    })
    const { collectHostMemory } = await loadHostMemory()

    const first = await collectHostMemory()
    const duringBackoff = await collectHostMemory()
    now.mockReturnValue(1_000 + 30_000)
    const recovered = await collectHostMemory()

    expect(first).toMatchObject({
      availableMemory: 100,
      availableMemorySource: 'free-memory',
      memoryUsagePercent: 90
    })
    expect(duringBackoff.availableMemorySource).toBe('free-memory')
    expect(recovered).toMatchObject({
      availableMemory: 470,
      availableMemorySource: 'memory-pressure'
    })
    expect(runProcessMock).toHaveBeenCalledTimes(2)
  })

  it('retries after a non-zero exit or unparsable output', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('darwin')
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    runProcessMock.mockResolvedValueOnce({
      code: 1,
      signal: null,
      stdout: '',
      stderr: 'boom',
      timedOut: false
    })
    runProcessMock.mockResolvedValueOnce({
      code: 0,
      signal: null,
      stdout: 'garbage',
      stderr: '',
      timedOut: false
    })
    const { collectHostMemory } = await loadHostMemory()

    await collectHostMemory()
    now.mockReturnValue(30_000)
    await collectHostMemory()
    now.mockReturnValue(60_000)
    await collectHostMemory()

    expect(runProcessMock).toHaveBeenCalledTimes(3)
  })

  it('stops asking macOS once the memory_pressure binary is missing', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('darwin')
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    runProcessMock.mockRejectedValue(
      Object.assign(new Error('spawn /usr/bin/memory_pressure ENOENT'), { code: 'ENOENT' })
    )
    const { collectHostMemory } = await loadHostMemory()

    const first = await collectHostMemory()
    now.mockReturnValue(10 * 60_000)
    const second = await collectHostMemory()

    expect(first.availableMemorySource).toBe('free-memory')
    expect(second.availableMemorySource).toBe('free-memory')
    expect(runProcessMock).toHaveBeenCalledTimes(1)
  })

  it('retries Linux MemAvailable after a transient read failure', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux')
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    readFileMock.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EIO' }))
    readFileMock.mockResolvedValue('MemAvailable: 0 kB\n')
    const { collectHostMemory } = await loadHostMemory()

    expect((await collectHostMemory()).availableMemorySource).toBe('free-memory')
    now.mockReturnValue(30_000)
    expect((await collectHostMemory()).availableMemorySource).toBe('proc-meminfo')
  })

  it('stops reading Linux MemAvailable once /proc/meminfo is missing', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux')
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    readFileMock.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    const { collectHostMemory } = await loadHostMemory()

    await collectHostMemory()
    now.mockReturnValue(10 * 60_000)
    await collectHostMemory()

    expect(readFileMock).toHaveBeenCalledTimes(1)
  })

  it('uses Linux MemAvailable and keeps the value within physical RAM', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('linux')
    vi.spyOn(os, 'totalmem').mockReturnValue(4 * 1024 * 1024)
    vi.spyOn(os, 'freemem').mockReturnValue(512 * 1024)
    readFileMock.mockResolvedValue('MemTotal: 4096 kB\nMemAvailable: 2048 kB\n')
    const { collectHostMemory } = await loadHostMemory()

    const host = await collectHostMemory()

    expect(host).toMatchObject({
      availableMemory: 2 * 1024 * 1024,
      availableMemorySource: 'proc-meminfo',
      usedMemory: 2 * 1024 * 1024,
      memoryUsagePercent: 50
    })
  })

  it('uses the bounded Node value on Windows', async () => {
    vi.spyOn(os, 'platform').mockReturnValue('win32')
    const { collectHostMemory } = await loadHostMemory()

    const host = await collectHostMemory()

    expect(host.availableMemory).toBe(100)
    expect(host.availableMemorySource).toBe('free-memory')
    expect(runProcessMock).not.toHaveBeenCalled()
    expect(readFileMock).not.toHaveBeenCalled()
  })
})

describe('host availability parsers', () => {
  it('parses bounded macOS percentages', async () => {
    const { parseDarwinAvailableMemory } = await loadHostMemory()

    expect(parseDarwinAvailableMemory('System-wide memory free percentage: 42%', 1_000)).toBe(420)
    expect(parseDarwinAvailableMemory('System-wide memory free percentage: 101%', 1_000)).toBeNull()
  })

  it('parses Linux MemAvailable in KiB', async () => {
    const { parseLinuxAvailableMemory } = await loadHostMemory()

    expect(parseLinuxAvailableMemory('MemAvailable:    1234 kB\n')).toBe(1234 * 1024)
    expect(parseLinuxAvailableMemory('MemFree: 1234 kB\n')).toBeNull()
  })
})
