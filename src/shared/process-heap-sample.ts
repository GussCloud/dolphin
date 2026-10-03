/** One process's self-reported JS heap and resident memory, in bytes. */
export type ProcessHeapSample = {
  rssBytes: number
  heapUsedBytes: number
  heapTotalBytes: number
  externalBytes: number
  arrayBuffersBytes: number
  /** V8's old-space ceiling; absent where the engine does not report one (Bun/JSC). */
  heapLimitBytes?: number
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Validates a sample received from another process (e.g. the terminal daemon). */
export function isProcessHeapSample(value: unknown): value is ProcessHeapSample {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const sample: Record<string, unknown> = { ...value }
  return (
    isNonNegativeFinite(sample.rssBytes) &&
    isNonNegativeFinite(sample.heapUsedBytes) &&
    isNonNegativeFinite(sample.heapTotalBytes) &&
    isNonNegativeFinite(sample.externalBytes) &&
    isNonNegativeFinite(sample.arrayBuffersBytes) &&
    (sample.heapLimitBytes === undefined || isNonNegativeFinite(sample.heapLimitBytes))
  )
}
