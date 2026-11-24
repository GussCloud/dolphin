import type { GpuProcessMemoryMetric } from '../../../shared/gpu-process-memory'

/**
 * Renderer memory pressure: the moment the renderer must shed what it can rebuild (hidden terminal
 * panes, retained hidden WebGL contexts) instead of only recording a highwater breadcrumb.
 *
 * Why these marks: they are the top highwater marks of renderer-memory-sampling — 80 % of the V8
 * heap limit, or 1000 MB of private footprint (which also sees xterm backing stores and WebGL
 * atlases that live outside every heap counter).
 */
export const RENDERER_MEMORY_PRESSURE_HEAP_RATIO = 0.8
export const RENDERER_MEMORY_PRESSURE_PRIVATE_MB = 1000
/**
 * GPU-process memory that sheds retained hidden WebGL, per metric — a reading is only ever held
 * against its own metric's mark.
 *
 * private-bytes (Windows commit): idle ~95 MB, three worktrees with five live terminal contexts
 * ~210 MB, each retained context ~30-40 MB, so the six-context cap alone tops out near 320 MB.
 * Past 400 MB something else is also drawing on the GPU, and the retained contexts are the part
 * that can be rebuilt on reveal.
 *
 * physical-footprint (macOS) also charges the visible windows' compositor IOSurfaces, so its
 * steady state sits far above Windows commit.
 */
export const RENDERER_MEMORY_PRESSURE_GPU_MB: Readonly<Record<GpuProcessMemoryMetric, number>> = {
  'private-bytes': 400,
  // Why: single-machine calibration — one window in normal use swung 435-1130 MB (lifetime peak
  // 1492 MB, up to 699 MB IOSurface); 2048 MB clears that plus the six-context cap (~240 MB).
  'physical-footprint': 2048
}
// Why: shedding remounts nothing by itself, but each pass costs a capture and a GC; one per five
// minutes keeps a renderer pinned above the mark from turning into a park loop.
export const RENDERER_MEMORY_PRESSURE_COOLDOWN_MS = 5 * 60_000

/** A GPU-process reading in MB, still tagged with the metric it was taken in. */
export type GpuMemoryPressureReading = {
  metric: GpuProcessMemoryMetric
  mb: number
}

export type RendererMemoryPressureSample = {
  heapRatio: number | null
  privateMB: number | null
  /** Absent or null where the host cannot report GPU-process memory (web, Linux). */
  gpu?: GpuMemoryPressureReading | null
}

export type RendererMemoryPressureSignal = RendererMemoryPressureSample & {
  trigger: 'heap' | 'private' | 'gpu'
}

type Listener = (signal: RendererMemoryPressureSignal) => void

const listeners = new Set<Listener>()
// Why separate: a GPU signal sheds only WebGL, so it must not hold back a renderer-heap shed.
const lastSignalAtMsByKind = new Map<'renderer' | 'gpu', number>()

export function readRendererMemoryPressure(
  sample: RendererMemoryPressureSample
): RendererMemoryPressureSignal | null {
  if (sample.heapRatio !== null && sample.heapRatio >= RENDERER_MEMORY_PRESSURE_HEAP_RATIO) {
    return { trigger: 'heap', ...sample }
  }
  if (sample.privateMB !== null && sample.privateMB >= RENDERER_MEMORY_PRESSURE_PRIVATE_MB) {
    return { trigger: 'private', ...sample }
  }
  const gpu = sample.gpu
  if (gpu && Number.isFinite(gpu.mb) && gpu.mb >= RENDERER_MEMORY_PRESSURE_GPU_MB[gpu.metric]) {
    return { trigger: 'gpu', ...sample }
  }
  return null
}

/** Emits a pressure signal for a sample above the marks, at most once per cool-down. */
export function noteRendererMemoryPressureSample(
  sample: RendererMemoryPressureSample,
  nowMs: number
): RendererMemoryPressureSignal | null {
  const signal = readRendererMemoryPressure(sample)
  if (signal === null) {
    return null
  }
  const kind = signal.trigger === 'gpu' ? 'gpu' : 'renderer'
  const lastSignalAtMs = lastSignalAtMsByKind.get(kind)
  if (
    lastSignalAtMs !== undefined &&
    nowMs - lastSignalAtMs < RENDERER_MEMORY_PRESSURE_COOLDOWN_MS
  ) {
    return null
  }
  lastSignalAtMsByKind.set(kind, nowMs)
  for (const listener of listeners) {
    try {
      listener(signal)
    } catch {
      // Why: one failing responder must not stop the others from shedding.
    }
  }
  return signal
}

export function subscribeRendererMemoryPressure(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetRendererMemoryPressureForTest(): void {
  listeners.clear()
  lastSignalAtMsByKind.clear()
}
