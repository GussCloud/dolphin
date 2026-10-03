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
// Why: shedding remounts nothing by itself, but each pass costs a capture and a GC; one per five
// minutes keeps a renderer pinned above the mark from turning into a park loop.
export const RENDERER_MEMORY_PRESSURE_COOLDOWN_MS = 5 * 60_000

export type RendererMemoryPressureSignal = {
  trigger: 'heap' | 'private'
  heapRatio: number | null
  privateMB: number | null
}

type Listener = (signal: RendererMemoryPressureSignal) => void

const listeners = new Set<Listener>()
let lastSignalAtMs: number | null = null

export function readRendererMemoryPressure(sample: {
  heapRatio: number | null
  privateMB: number | null
}): RendererMemoryPressureSignal | null {
  if (sample.heapRatio !== null && sample.heapRatio >= RENDERER_MEMORY_PRESSURE_HEAP_RATIO) {
    return { trigger: 'heap', ...sample }
  }
  if (sample.privateMB !== null && sample.privateMB >= RENDERER_MEMORY_PRESSURE_PRIVATE_MB) {
    return { trigger: 'private', ...sample }
  }
  return null
}

/** Emits a pressure signal for a sample above the marks, at most once per cool-down. */
export function noteRendererMemoryPressureSample(
  sample: { heapRatio: number | null; privateMB: number | null },
  nowMs: number
): RendererMemoryPressureSignal | null {
  const signal = readRendererMemoryPressure(sample)
  if (
    signal === null ||
    (lastSignalAtMs !== null && nowMs - lastSignalAtMs < RENDERER_MEMORY_PRESSURE_COOLDOWN_MS)
  ) {
    return null
  }
  lastSignalAtMs = nowMs
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
  lastSignalAtMs = null
}
