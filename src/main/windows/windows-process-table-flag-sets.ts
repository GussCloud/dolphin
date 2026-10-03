/**
 * The flag sets Dolphin asks the Windows process-tree addon for, and the row
 * shape each can honestly produce. A cheap caller gets a row type that cannot
 * carry what its flags did not pay for -- see
 * docs/reference/windows-process-enumeration.md.
 */

/** Everything a Toolhelp32 walk alone can answer. */
export type WindowsProcessIdentityRow = {
  pid: number
  ppid: number
  name: string
  /** Process creation time in Unix milliseconds, when the native snapshot provides it. */
  creationTimeMs?: number
}

/**
 * Adds the kernel's resource counters (Resource Manager). Each field is absent,
 * never zero, when the process denied a query handle.
 */
export type WindowsProcessResourceCountersRow = WindowsProcessIdentityRow & {
  /** Working set in bytes; 64-bit, unlike the retired `Memory` field. */
  workingSetBytes?: number
  /** Committed private bytes, resident or paged out. */
  privateBytes?: number
  /** Cumulative kernel + user CPU time in 100 ns units. */
  cpuTime100ns?: number
}

/** Adds the kernel-supplied command line. Only ask for this if you read it. */
export type WindowsProcessRow = WindowsProcessIdentityRow & {
  /** Full command line. Empty when the process denied a query handle. */
  command: string
}

export type NativeProcessInfo = {
  pid: number
  ppid: number
  name: string
  commandLine?: string
  creationTimeMs?: number
  workingSetBytes?: number
  privateBytes?: number
  cpuTime100ns?: number
}

export type WindowsProcessTreeModule = {
  ProcessDataFlag: {
    None: number
    CommandLine: number
    CreationTime?: number
    ResourceUsage?: number
  }
  /**
   * Flag bits the COMPILED addon reports, straight from `addon.cc`. Absent on a
   * build that predates the patch — which is not the same question as the enum
   * above, because pnpm patches the source tree and leaves the tarball's
   * prebuilt `.node` in place.
   */
  supportedProcessDataFlags?: number
  getProcessCreationTime?: (pid: number) => number | undefined
  getAllProcesses: (
    callback: (processes: NativeProcessInfo[] | undefined) => void,
    flags?: number
  ) => void
}

/**
 * Mirrors the package's enum; the addon takes the raw bit field. `Memory` (1)
 * is listed for completeness and is deliberately never set — see the projections
 * below.
 *
 * Naming `CreationTime` here only decides what we ASK for; whether the binary
 * answers is `supportedProcessDataFlags`, which the addon reports itself.
 */
export const PROCESS_DATA_FLAG = {
  None: 0,
  Memory: 1,
  CommandLine: 2,
  CreationTime: 4,
  ResourceUsage: 8
} as const

/** A flag set and the row shape it can honestly produce. */
export type ProcessRowProjection<Row> = {
  flags: (native: WindowsProcessTreeModule) => number
  fromNative: (row: NativeProcessInfo) => Row
  /**
   * The no-binding scan, on the one flag set it can serve. Absent on the other,
   * because a relay must never run two `Get-CimInstance` scans at ~1.4s each --
   * `readWindowsProcessIdentityTable` projects the detailed snapshot instead.
   */
  cimFallback?: () => Promise<Row[]>
}

export function toIdentityRow(row: {
  pid: number
  ppid: number
  name: string
  creationTimeMs?: number
}): WindowsProcessIdentityRow {
  return {
    pid: row.pid,
    ppid: row.ppid,
    name: row.name,
    ...(typeof row.creationTimeMs === 'number' ? { creationTimeMs: row.creationTimeMs } : {})
  }
}

/**
 * Toolhelp32 and nothing else: no `OpenProcess` per process, so this read has
 * none of the shape an EDR scores as walking another process's memory.
 */
export const IDENTITY_PROJECTION: ProcessRowProjection<WindowsProcessIdentityRow> = {
  flags: (native) => native.ProcessDataFlag.None | (native.ProcessDataFlag.CreationTime ?? 0),
  fromNative: toIdentityRow
}

/**
 * Adds, per process, one `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` and an
 * `NtQueryInformationProcess(ProcessCommandLineInformation)` -- which is what
 * agent recognition and port attribution match on. `Memory` is deliberately
 * absent: it took a second handle carrying `PROCESS_VM_READ` and then never read
 * through it, and the native field wraps above 4 GB. The Resource Manager reads
 * 64-bit counters from RESOURCE_PROJECTION instead.
 */
export const DETAILED_PROJECTION: ProcessRowProjection<WindowsProcessRow> = {
  flags: (native) => IDENTITY_PROJECTION.flags(native) | native.ProcessDataFlag.CommandLine,
  fromNative: (row) => ({ ...toIdentityRow(row), command: row.commandLine ?? '' })
}

function nonNegativeCounter(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Working set, private bytes, CPU time and start time from one
 * `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` per process -- the counters
 * Task Manager reads. It replaces the Resource Manager's `Get-CimInstance`
 * sweep, which forked `powershell.exe` on every two-second poll. CreationTime is
 * implied: the addon fills it from the same handle instead of opening a second.
 */
export const RESOURCE_PROJECTION: ProcessRowProjection<WindowsProcessResourceCountersRow> = {
  flags: () => PROCESS_DATA_FLAG.ResourceUsage,
  fromNative: (row) => {
    const workingSetBytes = nonNegativeCounter(row.workingSetBytes)
    const privateBytes = nonNegativeCounter(row.privateBytes)
    const cpuTime100ns = nonNegativeCounter(row.cpuTime100ns)
    return {
      ...toIdentityRow(row),
      ...(workingSetBytes === undefined ? {} : { workingSetBytes }),
      ...(privateBytes === undefined ? {} : { privateBytes }),
      ...(cpuTime100ns === undefined ? {} : { cpuTime100ns })
    }
  }
}
