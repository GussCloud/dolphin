// Periodic self-report of a long-lived host process's memory (main, terminal daemon, dolphind).
// Why: those processes are only sampled on demand or at crash time, so a slow leak over days
// stays invisible until the OS kills the process. A cheap line every few minutes in the
// process's own log makes the trend readable from a support bundle.
import { getHeapStatistics } from 'node:v8'
import type { ProcessHeapSample } from '../../shared/process-heap-sample'

export const PROCESS_HEAP_HEARTBEAT_INTERVAL_MS = 5 * 60_000

const MB = 1024 * 1024
// Why the gap: a heap hovering at the threshold would otherwise warn on every heartbeat.
const HEAP_PRESSURE_WARN_RATIO = 0.8
const HEAP_PRESSURE_REARM_RATIO = 0.7

function readHeapLimitBytes(): number | undefined {
  try {
    const limit = getHeapStatistics().heap_size_limit
    return Number.isFinite(limit) && limit > 0 ? limit : undefined
  } catch {
    // Why: Bun implements node:v8 only partially; a missing ceiling is not an error.
    return undefined
  }
}

export function readProcessHeapSample(): ProcessHeapSample {
  const usage = process.memoryUsage()
  const heapLimitBytes = readHeapLimitBytes()
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
    ...(heapLimitBytes === undefined ? {} : { heapLimitBytes })
  }
}

function toMegabytes(bytes: number): number {
  return Math.round((bytes / MB) * 10) / 10
}

/** Terse, log-friendly fields (MB, one decimal) — never user data. */
export function formatProcessHeapHeartbeatFields(
  sample: ProcessHeapSample,
  sessionCount: number | null
): Record<string, number> {
  return {
    rssMb: toMegabytes(sample.rssBytes),
    heapUsedMb: toMegabytes(sample.heapUsedBytes),
    heapTotalMb: toMegabytes(sample.heapTotalBytes),
    externalMb: toMegabytes(sample.externalBytes),
    arrayBuffersMb: toMegabytes(sample.arrayBuffersBytes),
    ...(sample.heapLimitBytes === undefined
      ? {}
      : { heapLimitMb: toMegabytes(sample.heapLimitBytes) }),
    ...(sessionCount === null ? {} : { sessionCount })
  }
}

/** Returns the used/limit ratio once per upward crossing of the warn threshold, else null. */
export function createHeapPressureTracker(): (sample: ProcessHeapSample) => number | null {
  let warned = false
  return (sample) => {
    const limit = sample.heapLimitBytes
    if (limit === undefined || limit <= 0) {
      return null
    }
    const ratio = sample.heapUsedBytes / limit
    if (warned) {
      warned = ratio >= HEAP_PRESSURE_REARM_RATIO
      return null
    }
    if (ratio < HEAP_PRESSURE_WARN_RATIO) {
      return null
    }
    warned = true
    return ratio
  }
}

export type ProcessHeapHeartbeatOptions = {
  emit: (fields: Record<string, number>) => void
  /** Called once each time heapUsed climbs to 80% of the V8 ceiling; re-arms below 70%. */
  emitHeapPressure?: (fields: Record<string, number>) => void
  /** Sessions this process hosts or tracks; null when unknown. */
  readSessionCount?: () => number | null
  intervalMs?: number
  readSample?: () => ProcessHeapSample
}

/** Starts the heartbeat; returns a stop function. The timer never keeps the process alive. */
export function startProcessHeapHeartbeat(options: ProcessHeapHeartbeatOptions): () => void {
  const readSample = options.readSample ?? readProcessHeapSample
  const observeHeapPressure = createHeapPressureTracker()
  const timer = setInterval(() => {
    try {
      let sessionCount: number | null = null
      try {
        sessionCount = options.readSessionCount?.() ?? null
      } catch {
        // Why: a session count is context, not the payload; still log the heap.
      }
      const heapSample = readSample()
      const fields = formatProcessHeapHeartbeatFields(heapSample, sessionCount)
      options.emit(fields)
      const pressureRatio = observeHeapPressure(heapSample)
      if (pressureRatio !== null) {
        options.emitHeapPressure?.({ ...fields, heapUsedPercent: Math.round(pressureRatio * 100) })
      }
    } catch {
      // Why: diagnostics must never throw into the host's event loop.
    }
  }, options.intervalMs ?? PROCESS_HEAP_HEARTBEAT_INTERVAL_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}
