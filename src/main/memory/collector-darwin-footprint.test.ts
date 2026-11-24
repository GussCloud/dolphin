import { beforeEach, describe, expect, it, vi } from 'vitest'
import os from 'node:os'
import type { MemorySnapshotStore } from './collector'
import { setAppEnvironment } from '../../shared/app-environment'

type AppMetricFixture = {
  pid: number
  type: string
  cpu: { percentCPUUsage: number }
  memory: { workingSetSize: number }
}

const { appMetricsMock, runProcessMock, execMock, listRegisteredPtysMock, footprintMock } =
  vi.hoisted(() => ({
    appMetricsMock: vi.fn<() => AppMetricFixture[]>(() => []),
    runProcessMock: vi.fn(),
    execMock: vi.fn(),
    listRegisteredPtysMock: vi.fn(),
    footprintMock: vi.fn<() => Promise<ReadonlyMap<number, number> | null>>()
  }))

vi.mock('child_process', () => ({
  exec: (cmd: string, opts: unknown, cb: (err: Error | null, out: { stdout: string }) => void) =>
    execMock(cmd, opts, cb)
}))

vi.mock('../../shared/child-process/run-process', () => ({
  runProcess: (spec: { program: string; args?: string[] }) => runProcessMock(spec)
}))

vi.mock('./darwin-process-footprint', () => ({
  readDarwinProcessFootprints: () => footprintMock()
}))

vi.mock('../windows/windows-process-table', () => ({
  isWindowsProcessResourceUsageAvailable: () => false,
  isWindowsProcessTableAvailable: () => false,
  readWindowsProcessResourceTable: () => Promise.reject(new Error('not under test'))
}))

// Why: host availability also forks on macOS; keep runProcess calls to the process sweep alone.
vi.mock('./host-memory', () => {
  const host = {
    totalMemory: 16 * 1024 ** 3,
    freeMemory: 0,
    availableMemory: 0,
    availableMemorySource: 'free-memory',
    usedMemory: 0,
    memoryUsagePercent: 0,
    cpuCoreCount: 8,
    loadAverage1m: 0
  }
  return { collectHostMemory: async () => host, fallbackHostMemory: () => host }
})

vi.mock('./pty-registry', () => ({
  listRegisteredPtys: listRegisteredPtysMock
}))

function appEnvironment() {
  return {
    getPath: () => process.cwd(),
    getAppPath: () => process.cwd(),
    getVersion: () => '0.0.0-test',
    isPackaged: () => false,
    onWillQuit: () => {},
    exit: () => {},
    getAppMetrics: appMetricsMock
  }
}

async function loadCollector() {
  vi.resetModules()
  const { setAppEnvironment: setResetAppEnvironment } = await import('../../shared/app-environment')
  setResetAppEnvironment(appEnvironment())
  return await import('./collector')
}

const emptyStore = {
  getFolderWorkspace: () => undefined,
  getProjectGroups: () => [],
  getWorktreeMeta: () => undefined,
  getRepo: () => undefined
} satisfies MemorySnapshotStore

const PS_ROWS = ['10 1 1.0 100', '20 10 2.0 200', '30 20 3.0 300'].join('\n')
const KIB = 1024

function mockPs(stdout: string | null) {
  // Why both: the current collector shells out through exec; the fix routes ps through runProcess.
  execMock.mockImplementation((_cmd, _opts, cb) =>
    stdout === null ? cb(new Error('ps failed'), { stdout: '' }) : cb(null, { stdout })
  )
  runProcessMock.mockImplementation(() =>
    Promise.resolve(
      stdout === null
        ? { code: 1, signal: null, stdout: '', stderr: 'ps failed', timedOut: false }
        : { code: 0, signal: null, stdout, stderr: '', timedOut: false }
    )
  )
}

function registerSession(pid: number) {
  listRegisteredPtysMock.mockReturnValue([
    { ptyId: 'pty-1', worktreeId: 'repo::/wt', sessionId: 's-1', paneKey: 'p-1', pid }
  ])
}

describe('collectMemorySnapshot on macOS', () => {
  beforeEach(() => {
    setAppEnvironment(appEnvironment())
    vi.restoreAllMocks()
    vi.spyOn(os, 'platform').mockReturnValue('darwin')
    appMetricsMock.mockReset()
    appMetricsMock.mockReturnValue([])
    runProcessMock.mockReset()
    execMock.mockReset()
    footprintMock.mockReset()
    footprintMock.mockResolvedValue(null)
    listRegisteredPtysMock.mockReset()
    listRegisteredPtysMock.mockReturnValue([])
  })

  it('runs ps through runProcess with an absolute path and the C locale', async () => {
    mockPs(PS_ROWS)
    const { collectMemorySnapshot } = await loadCollector()

    await collectMemorySnapshot(emptyStore)

    expect(execMock).not.toHaveBeenCalled()
    expect(runProcessMock).toHaveBeenCalledTimes(1)
    const spec = runProcessMock.mock.calls[0][0]
    expect(spec.program).toBe('/bin/ps')
    expect(spec.args).toEqual(['-eo', 'pid=,ppid=,pcpu=,rss='])
    expect(spec.env).toMatchObject({ LC_ALL: 'C', LANG: 'C' })
  })

  it('reports every memory value as physical footprint when the helper answers', async () => {
    mockPs(PS_ROWS)
    footprintMock.mockResolvedValue(
      new Map([
        [10, 1000 * KIB],
        [20, 2000 * KIB],
        [30, 3000 * KIB]
      ])
    )
    appMetricsMock.mockReturnValue([
      { pid: 10, type: 'Browser', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 9 } }
    ])
    registerSession(20)
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(snap.processMemoryMetric).toBe('footprint')
    expect(snap.app.main.memory).toBe(1000 * KIB)
    expect(snap.worktrees[0].sessions[0].memory).toBe((2000 + 3000) * KIB)
    expect(snap.worktrees[0].memory).toBe((2000 + 3000) * KIB)
    expect(snap.totalMemory).toBe((1000 + 2000 + 3000) * KIB)
    expect(snap.app.history.at(-1)).toBe(1000 * KIB)
  })

  it('never mixes RSS or working set into a footprint snapshot', async () => {
    mockPs(PS_ROWS)
    // pid 30 (session child) and 99 (an Electron helper ps missed) have no footprint.
    footprintMock.mockResolvedValue(
      new Map([
        [10, 1000 * KIB],
        [20, 2000 * KIB]
      ])
    )
    appMetricsMock.mockReturnValue([
      { pid: 10, type: 'Browser', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 9 } },
      { pid: 99, type: 'Renderer', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 4096 } }
    ])
    registerSession(20)
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(snap.processMemoryMetric).toBe('footprint')
    expect(snap.worktrees[0].sessions[0].memory).toBe(2000 * KIB)
    // Both processes still counted: absence of a byte figure is not absence of the process.
    expect(snap.worktrees[0].sessions[0].processCount).toBe(2)
    expect(snap.app.renderer.memory).toBe(0)
    expect(snap.totalMemory).toBe((1000 + 2000) * KIB)
  })

  it('keeps the whole snapshot RSS when the footprint helper is unavailable', async () => {
    mockPs(PS_ROWS)
    footprintMock.mockResolvedValue(null)
    registerSession(20)
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(snap.processMemoryMetric).toBe('rss')
    expect(snap.worktrees[0].sessions[0].memory).toBe((200 + 300) * KIB)
  })

  it('marks a failed ps scan explicitly instead of reporting zeroed sessions', async () => {
    mockPs(null)
    footprintMock.mockResolvedValue(new Map([[20, 2000 * KIB]]))
    registerSession(20)
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(snap.processScanFailed).toBe(true)
    expect(snap.trackedProcessCount).toBeUndefined()
    expect(snap.worktrees[0].sessions[0].processCount).toBeUndefined()
    // Why: a failed sweep must not leave a 0 in the sparkline that reads as a memory drop.
    expect(snap.app.history).toEqual([])
    expect(snap.worktrees[0].history).toEqual([])
  })

  it('marks a snapshot that threw as a failed scan', async () => {
    mockPs(PS_ROWS)
    appMetricsMock.mockImplementation(() => {
      throw new Error('metrics unavailable')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(snap.processScanFailed).toBe(true)
  })

  it('restarts the sparkline history when the metric switches between footprint and RSS', async () => {
    mockPs(PS_ROWS)
    footprintMock.mockResolvedValueOnce(
      new Map([
        [10, 1000 * KIB],
        [20, 2000 * KIB],
        [30, 3000 * KIB]
      ])
    )
    footprintMock.mockResolvedValueOnce(
      new Map([
        [10, 1000 * KIB],
        [20, 2000 * KIB],
        [30, 3000 * KIB]
      ])
    )
    footprintMock.mockResolvedValue(null)
    appMetricsMock.mockReturnValue([
      { pid: 10, type: 'Browser', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 9 } }
    ])
    registerSession(20)
    const { collectMemorySnapshot } = await loadCollector()

    await collectMemorySnapshot(emptyStore)
    const second = await collectMemorySnapshot(emptyStore)
    expect(second.app.history).toEqual([1000 * KIB, 1000 * KIB])
    const rss = await collectMemorySnapshot(emptyStore)

    expect(rss.processMemoryMetric).toBe('rss')
    expect(rss.app.history).toEqual([100 * KIB])
    expect(rss.worktrees[0].history).toEqual([(200 + 300) * KIB])
  })

  it('keeps the history through a failed scan when the metric does not change', async () => {
    footprintMock.mockResolvedValue(new Map([[10, 1000 * KIB]]))
    appMetricsMock.mockReturnValue([
      { pid: 10, type: 'Browser', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 9 } }
    ])
    const { collectMemorySnapshot } = await loadCollector()

    mockPs(PS_ROWS)
    await collectMemorySnapshot(emptyStore)
    mockPs(null)
    const failed = await collectMemorySnapshot(emptyStore)
    mockPs(PS_ROWS)
    const recovered = await collectMemorySnapshot(emptyStore)

    expect(failed.app.history).toEqual([1000 * KIB])
    expect(recovered.app.history).toEqual([1000 * KIB, 1000 * KIB])
  })

  it('does not flag a healthy scan', async () => {
    mockPs(PS_ROWS)
    registerSession(20)
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(snap.processScanFailed).toBeUndefined()
    expect(snap.worktrees[0].sessions[0].processCount).toBe(2)
  })
})

describe('collectMemorySnapshot on Linux', () => {
  beforeEach(() => {
    setAppEnvironment(appEnvironment())
    vi.restoreAllMocks()
    vi.spyOn(os, 'platform').mockReturnValue('linux')
    appMetricsMock.mockReset()
    appMetricsMock.mockReturnValue([])
    runProcessMock.mockReset()
    execMock.mockReset()
    footprintMock.mockReset()
    footprintMock.mockResolvedValue(new Map([[20, 1]]))
    listRegisteredPtysMock.mockReset()
    registerSession(20)
  })

  it('resolves ps from PATH through runProcess and never asks for footprint', async () => {
    mockPs(PS_ROWS)
    const { collectMemorySnapshot } = await loadCollector()

    const snap = await collectMemorySnapshot(emptyStore)

    expect(execMock).not.toHaveBeenCalled()
    expect(runProcessMock.mock.calls[0][0].program).toBe('ps')
    expect(footprintMock).not.toHaveBeenCalled()
    expect(snap.processMemoryMetric).toBe('rss')
    expect(snap.worktrees[0].sessions[0].memory).toBe((200 + 300) * KIB)
  })
})
