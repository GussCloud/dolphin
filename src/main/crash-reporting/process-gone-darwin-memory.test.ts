import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostMemory } from '../../shared/process-stats-types'

const mocks = vi.hoisted(() => ({
  getAppMetrics: vi.fn((): unknown[] => []),
  collectHostMemory: vi.fn<() => Promise<HostMemory>>(),
  readDarwinProcessFootprints:
    vi.fn<(pids?: readonly number[]) => Promise<ReadonlyMap<number, number> | null>>()
}))
vi.mock('electron', () => ({ app: { getAppMetrics: mocks.getAppMetrics } }))
vi.mock('../memory/host-memory', () => ({ collectHostMemory: mocks.collectHostMemory }))
vi.mock('../memory/darwin-process-footprint', () => ({
  readDarwinProcessFootprints: mocks.readDarwinProcessFootprints
}))

import {
  attachDarwinProcessGoneMemory,
  readDarwinProcessGoneMemoryDetails
} from './process-gone-darwin-memory'

const MB = 1024 * 1024

function hostMemory(overrides: Partial<HostMemory>): HostMemory {
  return {
    totalMemory: 16_384 * MB,
    freeMemory: 200 * MB,
    availableMemory: 4_096 * MB,
    availableMemorySource: 'memory-pressure',
    usedMemory: 12_288 * MB,
    memoryUsagePercent: 75,
    cpuCoreCount: 8,
    loadAverage1m: 1,
    ...overrides
  }
}

const metrics = [
  { pid: 1, type: 'Browser' },
  { pid: 2, type: 'GPU' },
  { pid: 3, type: 'Tab' },
  { pid: 4, type: 'Tab' }
]

describe('macOS process-gone memory details', () => {
  beforeEach(() => {
    mocks.collectHostMemory.mockReset()
    mocks.readDarwinProcessFootprints.mockReset()
  })

  it('carries a memory_pressure reading and the survivors’ footprints, under their own keys', async () => {
    mocks.collectHostMemory.mockResolvedValue(hostMemory({}))
    mocks.readDarwinProcessFootprints.mockResolvedValue(
      new Map([
        [2, 900 * MB],
        [3, 300 * MB],
        [4, 650 * MB]
      ])
    )
    const details = await readDarwinProcessGoneMemoryDetails(metrics, 1_000, () => 1_250)
    expect(mocks.readDarwinProcessFootprints).toHaveBeenCalledWith([2, 3, 4])
    expect(details).toEqual({
      systemMemoryPressureSignal: 'memory-pressure-free-percentage',
      systemMemoryPressureAvailableMB: 4_096,
      systemMemoryPressureReadDelayMs: 250,
      processMetricsRendererFootprintMB: 650,
      processMetricsGpuFootprintMB: 900
    })
    expect(details).not.toHaveProperty('processMetricsRendererPrivateMB')
  })

  it('reports no pressure when memory_pressure was unavailable, rather than free memory', async () => {
    mocks.collectHostMemory.mockResolvedValue(hostMemory({ availableMemorySource: 'free-memory' }))
    mocks.readDarwinProcessFootprints.mockResolvedValue(null)
    await expect(readDarwinProcessGoneMemoryDetails(metrics, 0, () => 0)).resolves.toEqual({})
  })

  it('survives a failing host read or footprint helper with whatever is left', async () => {
    mocks.collectHostMemory.mockRejectedValue(new Error('spawn failed'))
    mocks.readDarwinProcessFootprints.mockResolvedValue(new Map([[3, 300 * MB]]))
    await expect(readDarwinProcessGoneMemoryDetails(metrics, 0, () => 0)).resolves.toEqual({
      processMetricsRendererFootprintMB: 300
    })
    mocks.collectHostMemory.mockResolvedValue(hostMemory({}))
    mocks.readDarwinProcessFootprints.mockRejectedValue(new Error('helper failed'))
    await expect(readDarwinProcessGoneMemoryDetails(metrics, 0, () => 0)).resolves.toMatchObject({
      systemMemoryPressureAvailableMB: 4_096
    })
  })

  it('attaches the reading to the recorded report on macOS only', async () => {
    mocks.getAppMetrics.mockReturnValue(metrics)
    mocks.collectHostMemory.mockResolvedValue(hostMemory({}))
    mocks.readDarwinProcessFootprints.mockResolvedValue(null)
    const attachDetails = vi.fn(async () => null)
    const recorded = Promise.resolve({ id: 'report-1' })

    await attachDarwinProcessGoneMemory(attachDetails, recorded, 'linux')
    expect(mocks.collectHostMemory).not.toHaveBeenCalled()
    expect(attachDetails).not.toHaveBeenCalled()

    await attachDarwinProcessGoneMemory(attachDetails, recorded, 'darwin')
    expect(attachDetails).toHaveBeenCalledWith(
      'report-1',
      expect.objectContaining({ systemMemoryPressureAvailableMB: 4_096 })
    )
  })

  it('attaches nothing when there is nothing to say, or the report never persisted', async () => {
    mocks.getAppMetrics.mockReturnValue(metrics)
    mocks.collectHostMemory.mockResolvedValue(hostMemory({ availableMemorySource: 'free-memory' }))
    mocks.readDarwinProcessFootprints.mockResolvedValue(null)
    const attachDetails = vi.fn(async () => null)
    await attachDarwinProcessGoneMemory(attachDetails, Promise.resolve({ id: 'r' }), 'darwin')
    mocks.collectHostMemory.mockResolvedValue(hostMemory({}))
    await attachDarwinProcessGoneMemory(attachDetails, Promise.reject(new Error('disk')), 'darwin')
    expect(attachDetails).not.toHaveBeenCalled()
  })
})
