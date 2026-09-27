import type { DaemonMemory } from '../../shared/process-stats-types'
import { clampMemoryMetric, optionalCommitField } from './memory-snapshot-values'

/** One row from the host-wide process listing. */
export type ProcRow = {
  pid: number
  ppid: number
  /** Percent of one core (may exceed 100 on multi-core). */
  cpu: number
  /** Resident memory in bytes. */
  memory: number
  /** Committed bytes, resident or paged out. Absent when the host cannot report it. */
  privateMemory?: number
  /** Image name, when the sweep reports one (Windows CIM only). */
  name?: string
}

/** Indexed view of a single host process sweep. */
export type ProcIndex = {
  byPid: Map<number, ProcRow>
  childrenOf: Map<number, number[]>
  /**
   * Whether this sweep reported committed bytes at all. Data-driven rather than
   * platform-driven: the Windows typeperf fallback can be missing the counter,
   * and reporting a 0 sum then would read as "agents commit nothing".
   */
  hasPrivateMemory: boolean
}

/** Walk every descendant PID of `root`, inclusive. Exported for tests. */
export function collectSubtree(
  index: ProcIndex,
  root: number,
  excludedPids?: ReadonlySet<number>
): number[] {
  const result: number[] = []
  const seen = new Set<number>()
  const queue = [root]
  while (queue.length > 0) {
    const pid = queue.pop()
    if (pid === undefined) {
      break
    }
    // Once a PID was attributed to an earlier PTY, its complete subtree was
    // already traversed. Do not walk those descendants again for overlapping
    // PTY roots (common when several panes share a supervisor).
    if (seen.has(pid) || excludedPids?.has(pid)) {
      continue
    }
    seen.add(pid)
    if (index.byPid.has(pid)) {
      result.push(pid)
    }
    const kids = index.childrenOf.get(pid)
    if (kids) {
      for (const kid of kids) {
        queue.push(kid)
      }
    }
  }
  return result
}

/** Exported for tests: the daemon's own row plus a count of descendants no session claimed. */
export function collectDaemonUsage(
  index: ProcIndex,
  daemonPid: number | null,
  claimed: ReadonlySet<number>
): DaemonMemory | undefined {
  if (daemonPid === null) {
    return undefined
  }
  const row = index.byPid.get(daemonPid)
  if (!row) {
    return undefined
  }
  // Why: a Windows ConPTY session is two daemon children, the shell and its OpenConsole host; the
  // host is expected once per claimed shell, and only a surplus one is unexplained.
  let excusedConsoleHosts = (index.childrenOf.get(daemonPid) ?? []).filter((pid) =>
    claimed.has(pid)
  ).length
  const untracked = collectSubtree(index, daemonPid, claimed).filter((pid) => {
    if (pid === daemonPid) {
      return false
    }
    const row = index.byPid.get(pid)
    if (row?.ppid === daemonPid && isConsoleHostName(row.name) && excusedConsoleHosts > 0) {
      excusedConsoleHosts -= 1
      return false
    }
    return true
  })
  return {
    pid: daemonPid,
    cpu: clampMemoryMetric(row.cpu),
    memory: clampMemoryMetric(row.memory),
    ...optionalCommitField(index.hasPrivateMemory, clampMemoryMetric(row.privateMemory)),
    untrackedDescendantCount: untracked.length
  }
}

const CONSOLE_HOST_NAMES = new Set(['openconsole.exe', 'conhost.exe'])

function isConsoleHostName(name: string | undefined): boolean {
  return name !== undefined && CONSOLE_HOST_NAMES.has(name.toLowerCase())
}
