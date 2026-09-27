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
  const untracked = collectSubtree(index, daemonPid, claimed).filter((pid) => pid !== daemonPid)
  return {
    pid: daemonPid,
    cpu: clampMemoryMetric(row.cpu),
    memory: clampMemoryMetric(row.memory),
    ...optionalCommitField(index.hasPrivateMemory, clampMemoryMetric(row.privateMemory)),
    untrackedDescendantCount: untracked.length
  }
}
