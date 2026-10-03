import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __setWindowsProcessTreeLoaderForTests,
  __setWindowsProcessTreeRequireForTests,
  isWindowsProcessResourceUsageAvailable,
  readWindowsProcessResourceTable,
  readWindowsProcessTableFresh
} from './windows-process-table'

const RESOURCE_USAGE_FLAG = 8
const PROCESS_DATA_FLAG = { None: 0, Memory: 1, CommandLine: 2, CreationTime: 4, ResourceUsage: 8 }

type NativeRow = {
  pid: number
  ppid: number
  name: string
  commandLine?: string
  creationTimeMs?: number
  workingSetBytes?: number
  privateBytes?: number
  cpuTime100ns?: number
}

const SELF_COUNTERS = {
  creationTimeMs: 1_700_000_000_000,
  workingSetBytes: 6 * 2 ** 30,
  privateBytes: 512 * 2 ** 20,
  cpuTime100ns: 12_345_678
}

/** Rows shaped by the flags actually asked for, each field on its own bit. */
function rowsFor(flags: number, includeSelf = true): NativeRow[] {
  const rows: NativeRow[] = [
    { pid: process.pid, ppid: 0, name: 'vitest.exe' },
    { pid: 4, ppid: 0, name: 'System' }
  ]
  return rows
    .filter((row) => includeSelf || row.pid !== process.pid)
    .map((row) => ({
      ...row,
      ...(flags & PROCESS_DATA_FLAG.CommandLine ? { commandLine: `${row.name} --run` } : {}),
      ...(flags & RESOURCE_USAGE_FLAG && row.pid === process.pid ? SELF_COUNTERS : {})
    }))
}

let calls: number[] = []
let inFlight = 0
let maxInFlight = 0

/** Bare addon with no queue, so overlapping native calls are observable. */
function installAddon(supportedProcessDataFlags: number | undefined, includeSelf = true): void {
  __setWindowsProcessTreeLoaderForTests(() => ({
    ProcessDataFlag: PROCESS_DATA_FLAG,
    supportedProcessDataFlags,
    getAllProcesses: (callback, flags) => {
      const requested = flags ?? 0
      calls.push(requested)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      setTimeout(() => {
        inFlight -= 1
        callback(rowsFor(requested, includeSelf))
      }, 0)
    }
  }))
}

describe('windows process resource counters', () => {
  let platform: PropertyDescriptor | undefined

  beforeEach(() => {
    calls = []
    inFlight = 0
    maxInFlight = 0
    platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
  })

  afterEach(() => {
    __setWindowsProcessTreeLoaderForTests()
    if (platform) {
      Object.defineProperty(process, 'platform', platform)
    }
  })

  it('is available only when the compiled binary reports the ResourceUsage bit', () => {
    installAddon(15)
    expect(isWindowsProcessResourceUsageAvailable()).toBe(true)

    // Patched lib/index.js over a binary built before flag 8 existed.
    installAddon(7)
    expect(isWindowsProcessResourceUsageAvailable()).toBe(false)

    installAddon(undefined)
    expect(isWindowsProcessResourceUsageAvailable()).toBe(false)

    __setWindowsProcessTreeLoaderForTests(() => null)
    expect(isWindowsProcessResourceUsageAvailable()).toBe(false)
  })

  it('refuses without touching the addon when the binary cannot report counters', async () => {
    installAddon(7)
    await expect(readWindowsProcessResourceTable()).rejects.toThrow(/unavailable/)
    expect(calls).toEqual([])
  })

  it('asks for ResourceUsage alone and maps 64-bit counters and start time', async () => {
    installAddon(15)
    const rows = await readWindowsProcessResourceTable()

    // CreationTime is not added: the addon fills it from the same handle.
    expect(calls).toEqual([RESOURCE_USAGE_FLAG])
    expect(rows).toEqual([
      { pid: process.pid, ppid: 0, name: 'vitest.exe', ...SELF_COUNTERS },
      // A process that denied the handle carries no counters, not zeros.
      { pid: 4, ppid: 0, name: 'System' }
    ])
  })

  it('drops counters that are not finite non-negative numbers', async () => {
    __setWindowsProcessTreeLoaderForTests(() => ({
      ProcessDataFlag: PROCESS_DATA_FLAG,
      supportedProcessDataFlags: 15,
      getAllProcesses: (callback) =>
        callback([
          {
            pid: process.pid,
            ppid: 0,
            name: 'vitest.exe',
            workingSetBytes: -1,
            privateBytes: Number.NaN,
            cpuTime100ns: 10
          }
        ])
    }))
    await expect(readWindowsProcessResourceTable()).resolves.toEqual([
      { pid: process.pid, ppid: 0, name: 'vitest.exe', cpuTime100ns: 10 }
    ])
  })

  it('rejects a table missing our own process, as every flag set does', async () => {
    installAddon(15, false)
    await expect(readWindowsProcessResourceTable()).rejects.toThrow(/unreadable/)
  })

  it('serializes with the detailed reader so neither is served the other flag set', async () => {
    installAddon(15)
    const [resource, detailed] = await Promise.all([
      readWindowsProcessResourceTable(),
      readWindowsProcessTableFresh()
    ])

    expect(maxInFlight).toBe(1)
    expect(calls).toEqual([
      RESOURCE_USAGE_FLAG,
      PROCESS_DATA_FLAG.CommandLine | PROCESS_DATA_FLAG.CreationTime
    ])
    expect(resource.find((row) => row.pid === process.pid)?.privateBytes).toBe(
      SELF_COUNTERS.privateBytes
    )
    expect(detailed.find((row) => row.pid === process.pid)?.command).toBe('vitest.exe --run')
  })

  it('still binds an older staged relay addon that predates ResourceUsage', async () => {
    // A Windows SSH host keeps its staged .node until the relay is redeployed.
    __setWindowsProcessTreeRequireForTests((specifier: string) => {
      if (specifier === '@vscode/windows-process-tree') {
        throw new Error('not installed on a relay host')
      }
      return {
        supportedProcessDataFlags: 7,
        getProcessList: (callback: (rows: NativeRow[]) => void, flags: number) => {
          calls.push(flags)
          callback(rowsFor(flags))
        }
      }
    })

    expect(isWindowsProcessResourceUsageAvailable()).toBe(false)
    const detailed = await readWindowsProcessTableFresh()
    expect(detailed.find((row) => row.pid === process.pid)?.command).toBe('vitest.exe --run')
    await expect(readWindowsProcessResourceTable()).rejects.toThrow(/unavailable/)
    expect(calls).not.toContain(RESOURCE_USAGE_FLAG)
    __setWindowsProcessTreeRequireForTests()
  })
})
