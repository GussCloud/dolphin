import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import type { GpuProcessMemory } from '../../shared/gpu-process-memory'
import { readDarwinProcessFootprints } from '../memory/darwin-process-footprint'

const BYTES_PER_KILOBYTE = 1024

/**
 * Memory charged to the GPU process: where retained terminal WebGL contexts and their glyph
 * atlases live, which no renderer footprint counts. Windows private bytes where Electron reports
 * them, macOS physical footprint otherwise; null on Linux — working set would count shared driver
 * mappings as pressure.
 */
export async function readGpuProcessMemory(
  platform: NodeJS.Platform = process.platform
): Promise<GpuProcessMemory | null> {
  if (!hasAppEnvironment()) {
    return null
  }
  const gpu = getAppEnvironment()
    .getAppMetrics()
    .find((metric) => metric.type === 'GPU')
  if (!gpu) {
    return null
  }
  const privateKB = gpu.memory?.privateBytes
  if (isPositiveFinite(privateKB)) {
    return { metric: 'private-bytes', kilobytes: privateKB }
  }
  if (platform !== 'darwin' || !Number.isSafeInteger(gpu.pid) || gpu.pid <= 0) {
    return null
  }
  try {
    const footprintBytes = (await readDarwinProcessFootprints([gpu.pid]))?.get(gpu.pid)
    return isPositiveFinite(footprintBytes)
      ? { metric: 'physical-footprint', kilobytes: footprintBytes / BYTES_PER_KILOBYTE }
      : null
  } catch {
    return null
  }
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
