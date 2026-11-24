import { app } from 'electron'
import type { CrashReportDetailValue } from '../../shared/crash-reporting'
import { collectHostMemory } from '../memory/host-memory'
import { readDarwinProcessFootprints } from '../memory/darwin-process-footprint'
import { SYSTEM_MEMORY_KEY_PREFIX } from './system-memory-details'

// ─── macOS gone-time memory ─────────────────────────────────────────
// Why after the report: both reads spawn a helper, and the crash record must
// persist synchronously before recovery reloads, so these attach to it later.
// Like the other gone-time reads, they see the machine after the corpse
// returned its pages; the delay field says how much later.

type CrashReportDetails = Record<string, CrashReportDetailValue>

type MetricLike = { pid?: unknown; type?: unknown }

const BYTES_PER_MB = 1024 * 1024

function footprintBucket(type: unknown): 'renderer' | 'gpu' | null {
  const normalized = typeof type === 'string' ? type.toLowerCase() : ''
  if (normalized === 'renderer' || normalized === 'tab') {
    return 'renderer'
  }
  return normalized === 'gpu' ? 'gpu' : null
}

async function hostPressureDetails(
  goneAtMs: number,
  now: () => number
): Promise<CrashReportDetails> {
  try {
    const host = await collectHostMemory()
    // Why: the free-memory fallback is not a pressure reading; absent beats a healthy-looking guess.
    if (host.availableMemorySource !== 'memory-pressure') {
      return {}
    }
    return {
      [`${SYSTEM_MEMORY_KEY_PREFIX}PressureSignal`]: 'memory-pressure-free-percentage',
      [`${SYSTEM_MEMORY_KEY_PREFIX}PressureAvailableMB`]: Math.round(
        host.availableMemory / BYTES_PER_MB
      ),
      [`${SYSTEM_MEMORY_KEY_PREFIX}PressureReadDelayMs`]: Math.max(0, now() - goneAtMs)
    }
  } catch {
    return {}
  }
}

/** Largest physical footprint among surviving renderers, and the GPU process's. */
async function footprintDetails(metrics: readonly MetricLike[]): Promise<CrashReportDetails> {
  const bucketByPid = new Map<number, 'renderer' | 'gpu'>()
  for (const metric of metrics) {
    const bucket = footprintBucket(metric.type)
    if (bucket && typeof metric.pid === 'number' && Number.isSafeInteger(metric.pid)) {
      bucketByPid.set(metric.pid, bucket)
    }
  }
  if (bucketByPid.size === 0) {
    return {}
  }
  let footprints: ReadonlyMap<number, number> | null
  try {
    footprints = await readDarwinProcessFootprints([...bucketByPid.keys()])
  } catch {
    return {}
  }
  const details: CrashReportDetails = {}
  for (const [pid, bucket] of bucketByPid) {
    const bytes = footprints?.get(pid)
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
      continue
    }
    // Why not processMetricsRendererPrivateMB: that is Windows private bytes, a different metric.
    const key =
      bucket === 'renderer' ? 'processMetricsRendererFootprintMB' : 'processMetricsGpuFootprintMB'
    const mb = Math.round(bytes / BYTES_PER_MB)
    const previous = details[key]
    details[key] = typeof previous === 'number' ? Math.max(previous, mb) : mb
  }
  return details
}

export async function readDarwinProcessGoneMemoryDetails(
  metrics: readonly MetricLike[],
  goneAtMs: number,
  now: () => number = Date.now
): Promise<CrashReportDetails> {
  const [pressure, footprints] = await Promise.all([
    hostPressureDetails(goneAtMs, now),
    footprintDetails(metrics)
  ])
  return { ...pressure, ...footprints }
}

/** Attaches one macOS pressure and footprint reading to the report once it has persisted. */
export async function attachDarwinProcessGoneMemory(
  attachDetails: (reportId: string, details: CrashReportDetails) => Promise<unknown>,
  recorded: Promise<{ id: string }>,
  platform: NodeJS.Platform = process.platform
): Promise<void> {
  if (platform !== 'darwin') {
    return
  }
  const goneAtMs = Date.now()
  let metrics: MetricLike[] = []
  try {
    metrics = app.getAppMetrics()
  } catch {
    // Why: the pressure reading is still worth attaching without survivor footprints.
  }
  try {
    const [report, details] = await Promise.all([
      recorded,
      readDarwinProcessGoneMemoryDetails(metrics, goneAtMs)
    ])
    if (Object.keys(details).length > 0) {
      await attachDetails(report.id, details)
    }
  } catch (error) {
    // Why: a report that never persisted is reported by the recorder's own failure path.
    console.warn('[crash-reporting] Failed to attach macOS gone-time memory:', error)
  }
}
