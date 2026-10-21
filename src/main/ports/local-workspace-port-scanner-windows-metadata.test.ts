import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanWorkspacePorts } from './local-workspace-port-scanner'
import { resetWorkspacePortScanTimeoutBackoffForTests } from './local-workspace-port-scan-state'

const runPortScanCommandMock = vi.hoisted(() => vi.fn())
const windowsTable = vi.hoisted(() => ({
  readWindowsProcessTable: vi.fn(),
  readWindowsProcessCreationTime: vi.fn(),
  isWindowsProcessStartTimeAvailable: vi.fn()
}))

vi.mock('./port-scan-command-client', () => ({
  runPortScanCommand: runPortScanCommandMock,
  isPortScanWorkerUnavailableError: () => false
}))
vi.mock('../windows/windows-process-table', () => windowsTable)

const NETSTAT_OUTPUT = [
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       123',
  '  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4'
].join('\r\n')

// POSIX paths: attribution normalizes with the test host's path module, not win32's.
const worktrees = [{ id: 'repo::/repo', repoId: 'repo', displayName: 'main', path: '/repo' }]

function urlWatcherStub(): { lookup: () => undefined; reconcileScan: () => void } {
  return { lookup: () => undefined, reconcileScan: () => {} }
}

describe('Windows port scan metadata reuse', () => {
  let startTimes: Record<number, number | null>

  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    startTimes = { 123: 1_000, 4: null }
    runPortScanCommandMock.mockResolvedValue({ stdout: NETSTAT_OUTPUT, spawnMs: 5 })
    windowsTable.isWindowsProcessStartTimeAvailable.mockReturnValue(true)
    windowsTable.readWindowsProcessCreationTime.mockImplementation((pid: number) => startTimes[pid])
    windowsTable.readWindowsProcessTable.mockResolvedValue([
      { pid: 123, ppid: 1, name: 'node.exe', command: 'node /repo/server.js' },
      // System denies the command-line query; that empty answer must still be cached.
      { pid: 4, ppid: 0, name: 'System', command: '' }
    ])
  })

  afterEach(() => {
    resetWorkspacePortScanTimeoutBackoffForTests()
    vi.restoreAllMocks()
    runPortScanCommandMock.mockReset()
    for (const mock of Object.values(windowsTable)) {
      mock.mockReset()
    }
  })

  it('skips the process-table read while the same processes keep listening', async () => {
    const first = await scanWorkspacePorts(worktrees, urlWatcherStub())
    const second = await scanWorkspacePorts(worktrees, urlWatcherStub())

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(1)
    expect(runPortScanCommandMock).toHaveBeenCalledTimes(2)
    expect(second.ports).toEqual(first.ports)
    expect(second.ports.find((port) => port.port === 5173)).toMatchObject({
      processName: 'node.exe',
      kind: 'workspace'
    })
    expect(second.ports.find((port) => port.port === 445)?.processName).toBe('System')
  })

  it('re-reads the table when a recycled pid has a different start time', async () => {
    await scanWorkspacePorts(worktrees, urlWatcherStub())
    startTimes[123] = 2_000
    await scanWorkspacePorts(worktrees, urlWatcherStub())

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(2)
  })

  it('re-reads the table when a new listener appears', async () => {
    await scanWorkspacePorts(worktrees, urlWatcherStub())
    runPortScanCommandMock.mockResolvedValue({
      stdout: `${NETSTAT_OUTPUT}\r\n  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       123`,
      spawnMs: 5
    })
    await scanWorkspacePorts(worktrees, urlWatcherStub())

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(2)
  })

  it('always reads the table for a requireMetadata scan', async () => {
    await scanWorkspacePorts(worktrees, urlWatcherStub())
    await scanWorkspacePorts(worktrees, urlWatcherStub(), { requireMetadata: true })

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(2)
  })

  it('does not cache a pid the table did not list', async () => {
    windowsTable.readWindowsProcessTable.mockResolvedValue([
      { pid: 4, ppid: 0, name: 'System', command: '' }
    ])
    await scanWorkspacePorts(worktrees, urlWatcherStub())
    await scanWorkspacePorts(worktrees, urlWatcherStub())

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed table read', async () => {
    windowsTable.readWindowsProcessTable.mockRejectedValueOnce(new Error('denied'))
    await scanWorkspacePorts(worktrees, urlWatcherStub())
    await scanWorkspacePorts(worktrees, urlWatcherStub())

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(2)
  })

  it('probes every scan when the addon reports no process start times', async () => {
    windowsTable.isWindowsProcessStartTimeAvailable.mockReturnValue(false)
    await scanWorkspacePorts(worktrees, urlWatcherStub())
    await scanWorkspacePorts(worktrees, urlWatcherStub())

    expect(windowsTable.readWindowsProcessTable).toHaveBeenCalledTimes(2)
    expect(windowsTable.readWindowsProcessCreationTime).not.toHaveBeenCalled()
  })
})
