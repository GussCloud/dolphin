import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import type { GpuProcessMemory } from '../../shared/gpu-process-memory'

/**
 * The GPU process's private bytes: where retained terminal WebGL contexts and their glyph
 * atlases live, which no renderer footprint counts. Null where Electron reports no private
 * bytes (only Windows does) — working set would count shared driver mappings as pressure.
 */
export function readGpuProcessMemory(): GpuProcessMemory | null {
  if (!hasAppEnvironment()) {
    return null
  }
  const gpu = getAppEnvironment()
    .getAppMetrics()
    .find((metric) => metric.type === 'GPU')
  const privateKB = gpu?.memory?.privateBytes
  return typeof privateKB === 'number' && Number.isFinite(privateKB) && privateKB > 0
    ? { privateKB }
    : null
}
