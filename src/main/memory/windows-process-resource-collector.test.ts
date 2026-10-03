import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WindowsProcessResourceCountersRow } from '../windows/windows-process-table'

const { availableMock, tableAvailableMock, readTableMock, runProcessMock } = vi.hoisted(() => ({
  availableMock: vi.fn<() => boolean>(),
  tableAvailableMock: vi.fn<() => boolean>(),
  readTableMock: vi.fn<() => Promise<WindowsProcessResourceCountersRow[]>>(),
  runProcessMock: vi.fn()
}))

vi.mock('../windows/windows-process-table', () => ({
  isWindowsProcessResourceUsageAvailable: availableMock,
  isWindowsProcessTableAvailable: tableAvailableMock,
  readWindowsProcessResourceTable: readTableMock
}))

vi.mock('../../shared/child-process/run-process', () => ({
  runProcess: runProcessMock
}))

const START_MS = 1_700_000_000_000

function counters(
  overrides: Partial<WindowsProcessResourceCountersRow> = {}
): WindowsProcessResourceCountersRow {
  return {
    pid: 10,
    ppid: 1,
    name: 'node.exe',
    creationTimeMs: START_MS,
    workingSetBytes: 6 * 2 ** 30,
    privateBytes: 300 * 2 ** 20,
    cpuTime100ns: 0,
    ...overrides
  }
}

async function loadCollector() {
  vi.resetModules()
  return await import('./windows-process-resource-collector')
}

describe('Windows process resources from the native counters', () => {
  beforeEach(() => {
    availableMock.mockReset()
    readTableMock.mockReset()
    runProcessMock.mockReset()
    availableMock.mockReturnValue(true)
    tableAvailableMock.mockReset()
    tableAvailableMock.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads memory without forking a shell, keeping counters above 4 GB intact', async () => {
    readTableMock.mockResolvedValue([counters(), counters({ pid: 4, ppid: 0, name: 'System' })])
    const { enumerateWindowsProcessResources } = await loadCollector()

    const rows = await enumerateWindowsProcessResources()

    expect(runProcessMock).not.toHaveBeenCalled()
    expect(rows[0]).toEqual({
      pid: 10,
      ppid: 1,
      cpu: 0,
      memory: 6 * 2 ** 30,
      privateMemory: 300 * 2 ** 20,
      name: 'node.exe'
    })
  })

  it('derives CPU from cumulative time between two native samples', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(3_000)
    readTableMock
      .mockResolvedValueOnce([counters({ cpuTime100ns: 10_000_000 })])
      .mockResolvedValueOnce([counters({ cpuTime100ns: 30_000_000 })])
    const { enumerateWindowsProcessResources } = await loadCollector()

    await enumerateWindowsProcessResources()
    const second = await enumerateWindowsProcessResources()

    // 2 s of CPU time over 2 s of wall time.
    expect(second[0].cpu).toBe(100)
  })

  it('does not carry CPU time across a recycled pid', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(3_000)
    readTableMock
      .mockResolvedValueOnce([counters({ cpuTime100ns: 10_000_000 })])
      .mockResolvedValueOnce([counters({ cpuTime100ns: 30_000_000, creationTimeMs: START_MS + 1 })])
    const { enumerateWindowsProcessResources } = await loadCollector()

    await enumerateWindowsProcessResources()
    const second = await enumerateWindowsProcessResources()

    expect(second[0].cpu).toBe(0)
  })

  it('reports a process that denied its handle with no memory rather than a guess', async () => {
    readTableMock.mockResolvedValue([{ pid: 4, ppid: 0, name: 'System' }])
    const { enumerateWindowsProcessResources } = await loadCollector()

    const rows = await enumerateWindowsProcessResources()

    expect(rows).toEqual([{ pid: 4, ppid: 0, cpu: 0, memory: 0, name: 'System' }])
  })

  it('returns no rows instead of forking a shell when the native read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    readTableMock.mockRejectedValue(new Error('windows process table timed out'))
    const { enumerateWindowsProcessResources } = await loadCollector()

    await expect(enumerateWindowsProcessResources()).resolves.toEqual([])
    await expect(enumerateWindowsProcessResources()).resolves.toEqual([])

    expect(runProcessMock).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('keeps the per-poll CIM sweep when no native addon loads at all', async () => {
    availableMock.mockReturnValue(false)
    tableAvailableMock.mockReturnValue(false)
    runProcessMock.mockResolvedValue({
      code: 0,
      signal: null,
      stdout: '10\t1\t1048576\t0\t0\t638830000000000000\t2048\tnode.exe',
      stderr: '',
      timedOut: false
    })
    const { enumerateWindowsProcessResources } = await loadCollector()

    const rows = await enumerateWindowsProcessResources()

    expect(readTableMock).not.toHaveBeenCalled()
    expect(runProcessMock.mock.calls[0]?.[0]).toMatchObject({ program: 'powershell.exe' })
    expect(rows[0]).toMatchObject({ pid: 10, memory: 1_048_576, privateMemory: 2048 * 1024 })
  })

  it('sweeps at most every 30 s for an addon compiled before ResourceUsage existed', async () => {
    availableMock.mockReturnValue(false)
    const cimRow = (cpuTicks: number): string =>
      `10	1	1048576	${cpuTicks}	0	638830000000000000	2048	node.exe`
    const outputs = [cimRow(0), cimRow(300_000_000)]
    runProcessMock.mockImplementation(() =>
      Promise.resolve({
        code: 0,
        signal: null,
        stdout: outputs.shift() ?? '',
        stderr: '',
        timedOut: false
      })
    )
    let nowMs = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
    const { enumerateWindowsProcessResources } = await loadCollector()

    await enumerateWindowsProcessResources()
    nowMs += 2_000
    const cached = await enumerateWindowsProcessResources()
    nowMs += 28_000
    const resampled = await enumerateWindowsProcessResources()

    expect(readTableMock).not.toHaveBeenCalled()
    expect(runProcessMock).toHaveBeenCalledTimes(2)
    expect(cached[0]).toMatchObject({ pid: 10, memory: 1_048_576 })
    // 30 s of CPU over 30 s of wall time, despite the wide sample spacing.
    expect(resampled[0].cpu).toBe(100)
  })
})
