/**
 * Which OS counter a GPU-process reading is. Windows private bytes and macOS physical footprint
 * measure different memory (footprint also charges visible windows' IOSurfaces), so every
 * threshold is per metric and a reading is never compared against another metric's mark.
 */
export type GpuProcessMemoryMetric = 'private-bytes' | 'physical-footprint'

/** Memory charged to Chromium's GPU process, in kilobytes of the named metric. */
export type GpuProcessMemory = {
  metric: GpuProcessMemoryMetric
  kilobytes: number
}
