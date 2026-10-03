import { useAppStore } from '@/store'
import {
  classifyHostMemoryPressure,
  getSessionMemoryByPaneKey,
  type HostMemoryPressureLevel
} from './agent-hibernation-memory-pressure'

export async function sampleHostMemoryPressure(): Promise<HostMemoryPressureLevel> {
  try {
    return classifyHostMemoryPressure(await window.api.memory.getHostMemory())
  } catch {
    // An unreadable host never makes hibernation more aggressive.
    return 'none'
  }
}

/**
 * Per-pane session memory for ranking a pressured drain. Reuses the Resource Manager's
 * snapshot while fresh; otherwise pays one coalesced sweep — only under pressure.
 */
export async function readSessionMemoryByPaneKey(
  now: number,
  maxAgeMs: number
): Promise<Map<string, number>> {
  const cached = useAppStore.getState().memorySnapshot
  if (cached && now - cached.collectedAt <= maxAgeMs) {
    return getSessionMemoryByPaneKey(cached)
  }
  try {
    await useAppStore.getState().fetchMemorySnapshot()
  } catch {
    return new Map()
  }
  return getSessionMemoryByPaneKey(useAppStore.getState().memorySnapshot)
}
