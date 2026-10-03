import type { HostMemory, MemorySnapshot } from '../../../shared/process-stats-types'

/**
 * How short this host is on memory, as an input to agent hibernation. It only
 * shortens the idle window for agents running on this host; every other
 * hibernation gate still applies.
 */
export type HostMemoryPressureLevel = 'none' | 'elevated' | 'critical'

const GIB = 1024 * 1024 * 1024
// Why the byte caps: on a large host a fixed ratio would call many free GiB "pressure".
const ELEVATED_AVAILABLE_RATIO = 0.2
const ELEVATED_AVAILABLE_CAP_BYTES = 4 * GIB
const CRITICAL_AVAILABLE_RATIO = 0.1
const CRITICAL_AVAILABLE_CAP_BYTES = 2 * GIB
const ELEVATED_IDLE_DIVISOR = 4

export function classifyHostMemoryPressure(
  host: Pick<HostMemory, 'totalMemory' | 'availableMemory'> | null | undefined
): HostMemoryPressureLevel {
  const total = host?.totalMemory
  const available = host?.availableMemory
  if (
    typeof total !== 'number' ||
    typeof available !== 'number' ||
    !Number.isFinite(total) ||
    !Number.isFinite(available) ||
    total <= 0 ||
    available < 0
  ) {
    // Unknown memory must never make hibernation more aggressive.
    return 'none'
  }
  if (available < Math.min(total * CRITICAL_AVAILABLE_RATIO, CRITICAL_AVAILABLE_CAP_BYTES)) {
    return 'critical'
  }
  if (available < Math.min(total * ELEVATED_AVAILABLE_RATIO, ELEVATED_AVAILABLE_CAP_BYTES)) {
    return 'elevated'
  }
  return 'none'
}

/** Never lengthens the configured window and never goes below `floorMs`. */
export function getMemoryPressureIdleMs(
  configuredIdleMs: number,
  level: HostMemoryPressureLevel,
  floorMs: number
): number {
  if (level === 'critical') {
    return Math.min(configuredIdleMs, floorMs)
  }
  if (level === 'elevated') {
    return Math.min(
      configuredIdleMs,
      Math.max(floorMs, Math.round(configuredIdleMs / ELEVATED_IDLE_DIVISOR))
    )
  }
  return configuredIdleMs
}

export function getSessionMemoryByPaneKey(
  snapshot: Pick<MemorySnapshot, 'worktrees'> | null | undefined
): Map<string, number> {
  const memoryByPaneKey = new Map<string, number>()
  for (const worktree of snapshot?.worktrees ?? []) {
    for (const session of worktree.sessions) {
      if (!session.paneKey || !Number.isFinite(session.memory) || session.memory <= 0) {
        continue
      }
      memoryByPaneKey.set(
        session.paneKey,
        (memoryByPaneKey.get(session.paneKey) ?? 0) + session.memory
      )
    }
  }
  return memoryByPaneKey
}

/** Heaviest sessions first so a pressured drain reclaims the most memory soonest; stable otherwise. */
export function orderByHeaviestSession<T extends { paneKey: string }>(
  candidates: readonly T[],
  memoryByPaneKey: ReadonlyMap<string, number>
): T[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      memory: memoryByPaneKey.get(candidate.paneKey) ?? -1
    }))
    .sort((a, b) => b.memory - a.memory || a.index - b.index)
    .map(({ candidate }) => candidate)
}
