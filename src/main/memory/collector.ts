/**
 * Memory dashboard collector.
 *
 * One snapshot covers two sources:
 *   - Dolphin's own Electron processes, via `getAppEnvironment().getAppMetrics()`, bucketed
 *     into main / renderer / other.
 *   - Each registered PTY's process subtree, enumerated once from a host-
 *     wide process sweep (PowerShell CIM with a Typeperf fallback on Windows).
 *
 * On macOS every byte figure is physical footprint when the footprint helper
 * answers, otherwise the whole snapshot stays RSS — never a mix of the two.
 *
 * Memory samples are held in a per-key ring (one key per worktree, plus
 * a reserved app-total key) so the UI can draw a trend sparkline.
 *
 * Concurrent callers coalesce onto a single in-flight sweep so a burst of
 * renderer polls never produces overlapping child processes.
 */

import os from 'node:os'
import { getAppEnvironment, type AppEnvironment } from '../../shared/app-environment'
import type {
  AppMemory,
  MemorySnapshot,
  SessionMemory,
  UsageValues,
  WorktreeMemory
} from '../../shared/process-stats-types'
import { ORPHAN_WORKTREE_ID } from '../../shared/constants'
import { listRegisteredPtys } from './pty-registry'
import { collectHostMemory } from './host-memory'
import { readMemorySnapshotDaemonPid } from './daemon-pid-source'
import { collectDaemonUsage, collectSubtree } from './process-subtree'
import { sweepProcesses, type ProcessSweep } from './host-process-sweep'
import {
  createEmptyWorktreeMemoryBucket,
  alignMemoryHistoryMetric,
  pushAppMemoryHistory,
  pushMemoryHistorySample,
  readAppMemoryHistory,
  readMemoryHistory,
  resolveWorktreeMemoryNames,
  sweepStaleMemoryHistory,
  type MemorySnapshotStore,
  type WorktreeMemoryBucket
} from './memory-snapshot-buckets'
import {
  clampMemoryMetric,
  emptyMemorySnapshot,
  optionalCommitField,
  snapshotCommitFields
} from './memory-snapshot-values'

export type { MemorySnapshotStore } from './memory-snapshot-buckets'
export { collectDaemonUsage, collectSubtree } from './process-subtree'
export { parsePsOutput } from './host-process-sweep'

// ─── Module state ───────────────────────────────────────────────────

let inflight: Promise<MemorySnapshot> | null = null

// ─── Public API ─────────────────────────────────────────────────────

export async function collectMemorySnapshot(store: MemorySnapshotStore): Promise<MemorySnapshot> {
  // Why: coalescing relies on the persistence store being a process-wide
  // singleton at runtime. Concurrent callers all hand in the same instance,
  // so it is safe to return the existing in-flight promise (which was
  // kicked off with that same store) rather than starting a second sweep.
  if (inflight) {
    return inflight
  }
  inflight = runSnapshot(store)
    .catch((err) => {
      console.warn('[memory] snapshot failed; returning empty', err)
      return emptyMemorySnapshot()
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

// ─── Electron app process bucketing ─────────────────────────────────

type AppBucketsRaw = Omit<AppMemory, 'history'>

function electronMetricMemoryBytes(
  proc: ReturnType<AppEnvironment['getAppMetrics']>[number],
  sweep: ProcessSweep
): number {
  const hostMemory = sweep.index.byPid.get(proc.pid)?.memory
  if (typeof hostMemory === 'number' && Number.isFinite(hostMemory) && hostMemory > 0) {
    return hostMemory
  }
  // Why: working set is neither footprint nor a measurement of a failed scan; mixing it in would
  // mislabel the snapshot.
  if (sweep.memoryMetric === 'footprint' || sweep.scanFailed) {
    return 0
  }
  // Why: on macOS, getAppEnvironment().getAppMetrics().workingSetSize can include large shared
  // Chromium/Electron mappings. Prefer the host RSS sweep used elsewhere, but
  // keep workingSetSize as a fallback when the process disappears mid-snapshot.
  return clampMemoryMetric(proc.memory?.workingSetSize) * 1024
}

function bucketElectronMetrics(sweep: ProcessSweep): AppBucketsRaw {
  const processIndex = sweep.index
  const main = { cpu: 0, memory: 0, privateMemory: 0 }
  const renderer = { cpu: 0, memory: 0, privateMemory: 0 }
  const other = { cpu: 0, memory: 0, privateMemory: 0 }

  for (const proc of getAppEnvironment().getAppMetrics()) {
    const cpu = clampMemoryMetric(proc.cpu?.percentCPUUsage)
    const memoryBytes = electronMetricMemoryBytes(proc, sweep)
    // Why the host row rather than Electron's own metric: getAppMetrics has no
    // commit figure for helper processes, and the sweep already indexed them.
    const privateBytes = clampMemoryMetric(processIndex.byPid.get(proc.pid)?.privateMemory)

    // Why: lowercase once so future Electron versions emitting different
    // casing ('browser' vs 'Browser') still bucket correctly.
    const type = (typeof proc.type === 'string' ? proc.type : '').toLowerCase()
    let target = other
    if (type === 'browser') {
      target = main
    } else if (type === 'renderer' || type === 'tab') {
      target = renderer
    }

    target.cpu += cpu
    target.memory += memoryBytes
    target.privateMemory += privateBytes
  }

  const usage = (bucket: typeof main): UsageValues => ({
    cpu: bucket.cpu,
    memory: bucket.memory,
    ...optionalCommitField(processIndex.hasPrivateMemory, bucket.privateMemory)
  })

  return {
    main: usage(main),
    renderer: usage(renderer),
    other: usage(other),
    ...usage({
      cpu: main.cpu + renderer.cpu + other.cpu,
      memory: main.memory + renderer.memory + other.memory,
      privateMemory: main.privateMemory + renderer.privateMemory + other.privateMemory
    })
  }
}

// ─── Main collection path ───────────────────────────────────────────

async function runSnapshot(store: MemorySnapshotStore): Promise<MemorySnapshot> {
  const [sweep, host] = await Promise.all([sweepProcesses(os.platform()), collectHostMemory()])
  const processIndex = sweep.index
  const appBuckets = bucketElectronMetrics(sweep)
  const ptys = listRegisteredPtys()

  // Why: when two PTYs share an ancestor in the process tree (e.g. a
  // supervisor, or a shell that re-execed), a naive walk would double-count
  // that ancestor's memory. Track which pids have already been claimed and
  // attribute to the first PTY (registration order) to see each pid.
  const claimed = new Set<number>()

  const orphan = createEmptyWorktreeMemoryBucket(
    ORPHAN_WORKTREE_ID,
    'Unattributed terminals',
    ORPHAN_WORKTREE_ID,
    'Other'
  )
  const worktreeBuckets = new Map<string, WorktreeMemoryBucket>()

  for (const pty of ptys) {
    let sessionCpu = 0
    let sessionMemory = 0
    let sessionPrivateMemory = 0
    let sessionProcessCount = 0

    if (pty.pid != null) {
      for (const pid of collectSubtree(processIndex, pty.pid, claimed)) {
        if (claimed.has(pid)) {
          continue
        }
        const row = processIndex.byPid.get(pid)
        if (!row) {
          continue
        }
        claimed.add(pid)
        sessionProcessCount += 1
        sessionCpu += row.cpu
        sessionMemory += row.memory
        // Why the whole subtree: an agent's committed bytes live in the
        // children it spawned (codex.exe, MCP servers), not in the shell.
        sessionPrivateMemory += clampMemoryMetric(row.privateMemory)
      }
    }

    const session: SessionMemory = {
      sessionId: pty.sessionId ?? pty.ptyId,
      paneKey: pty.paneKey,
      pid: pty.pid ?? 0,
      cpu: clampMemoryMetric(sessionCpu),
      memory: clampMemoryMetric(sessionMemory),
      ...optionalCommitField(processIndex.hasPrivateMemory, sessionPrivateMemory),
      // Why omitted on a failed scan: 0 would read as "this session's processes are gone".
      ...(sweep.scanFailed ? {} : { processCount: sessionProcessCount })
    }

    let bucket: WorktreeMemoryBucket
    if (pty.worktreeId) {
      const existing = worktreeBuckets.get(pty.worktreeId)
      if (existing) {
        bucket = existing
      } else {
        const names = resolveWorktreeMemoryNames(pty.worktreeId, store)
        bucket = createEmptyWorktreeMemoryBucket(
          pty.worktreeId,
          names.worktreeName,
          names.repoId,
          names.repoName
        )
        worktreeBuckets.set(pty.worktreeId, bucket)
      }
    } else {
      bucket = orphan
    }

    bucket.cpu += session.cpu
    bucket.memory += session.memory
    bucket.privateMemory += clampMemoryMetric(session.privateMemory)
    bucket.sessions.push(session)
  }

  const bucketList: WorktreeMemoryBucket[] = [...worktreeBuckets.values()]
  if (orphan.sessions.length > 0) {
    bucketList.push(orphan)
  }

  // Why: record this sweep's samples *before* reading back history, so the
  // returned arrays end with the freshly-collected value. Each write also
  // acts as a keep-alive so active worktrees survive the staleness sweep.
  // A failed scan records nothing, so the sparkline does not show a drop to 0.
  const now = Date.now()
  if (!sweep.scanFailed) {
    alignMemoryHistoryMetric(sweep.memoryMetric)
    pushAppMemoryHistory(appBuckets.memory, now)
    for (const bucket of bucketList) {
      pushMemoryHistorySample(bucket.worktreeId, bucket.memory, now)
    }
    sweepStaleMemoryHistory(now)
  }

  const worktrees: WorktreeMemory[] = bucketList.map(({ privateMemory, ...b }) => ({
    ...b,
    ...optionalCommitField(processIndex.hasPrivateMemory, privateMemory),
    history: readMemoryHistory(b.worktreeId)
  }))

  const daemon = collectDaemonUsage(processIndex, readMemorySnapshotDaemonPid(), claimed)

  let sessionCpuTotal = 0
  let sessionMemoryTotal = 0
  let sessionPrivateTotal = 0
  for (const wt of worktrees) {
    sessionCpuTotal += wt.cpu
    sessionMemoryTotal += wt.memory
    sessionPrivateTotal += clampMemoryMetric(wt.privateMemory)
  }

  return {
    app: { ...appBuckets, history: readAppMemoryHistory() },
    worktrees,
    host,
    processMemoryMetric: sweep.memoryMetric,
    ...snapshotCommitFields(
      processIndex.hasPrivateMemory,
      clampMemoryMetric(appBuckets.privateMemory) + sessionPrivateTotal
    ),
    totalCpu: appBuckets.cpu + sessionCpuTotal,
    totalMemory: appBuckets.memory + sessionMemoryTotal,
    ...(daemon ? { daemon } : {}),
    ...(sweep.scanFailed ? { processScanFailed: true } : { trackedProcessCount: claimed.size }),
    collectedAt: now
  }
}
