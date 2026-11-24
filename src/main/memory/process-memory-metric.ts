import os from 'node:os'
import type { ProcessMemoryMetric } from '../../shared/process-stats-types'

/** The per-snapshot metric: footprint only when this sweep's bytes all came from the footprint reader. */
export function getProcessMemoryMetric(
  platform: NodeJS.Platform = os.platform(),
  footprintAvailable = false
): ProcessMemoryMetric {
  if (footprintAvailable) {
    return 'footprint'
  }
  return platform === 'win32' ? 'working-set' : 'rss'
}
