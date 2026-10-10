// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./crash-breadcrumb-recorder', () => ({ recordRendererCrashBreadcrumb: vi.fn() }))
vi.mock('../components/browser-pane/host-guest/webview-registry', () => ({
  getBrowserWebviewMemoryProfile: () => ({ browserWebviewCount: 0, registeredBrowserGuestCount: 0 })
}))
vi.mock('./renderer-memory-profile', () => ({ collectRendererMemoryProfileCounts: () => ({}) }))

import {
  RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB,
  resetRendererMemoryPressureForTest,
  subscribeRendererMemoryPressure,
  type RendererMemoryPressureSignal
} from './renderer-memory-pressure'
import { recordRendererMemorySample, resetRendererMemorySampling } from './renderer-memory-sampling'

const calmHeap = {
  usedHeapKB: 10_000,
  totalHeapKB: 20_000,
  heapLimitKB: 4_000_000,
  mallocedKB: 1_000
}

function installCrashReportsApi(gpuPrivateMB: number | null | undefined): void {
  const crashReports = {
    readHeapStatistics: () => calmHeap,
    readProcessMemory: () => Promise.resolve({ privateKB: 200 * 1024 }),
    ...(gpuPrivateMB === undefined
      ? {}
      : {
          readGpuProcessMemory: () =>
            Promise.resolve(gpuPrivateMB === null ? null : { privateKB: gpuPrivateMB * 1024 })
        })
  }
  Reflect.set(window, 'api', { crashReports })
}

async function sampleTwice(): Promise<void> {
  // The footprint reads settle in the background; the second sample sees them.
  recordRendererMemorySample('test')
  await Promise.resolve()
  await Promise.resolve()
  recordRendererMemorySample('test')
}

describe('renderer memory sampling: GPU-process pressure', () => {
  let signals: RendererMemoryPressureSignal[]

  beforeEach(() => {
    resetRendererMemorySampling()
    resetRendererMemoryPressureForTest()
    signals = []
    subscribeRendererMemoryPressure((signal) => signals.push(signal))
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'api')
  })

  it('signals GPU pressure once the GPU process passes its mark', async () => {
    installCrashReportsApi(RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB + 50)
    await sampleTwice()
    expect(signals.map((signal) => signal.trigger)).toEqual(['gpu'])
    expect(signals[0]?.gpuPrivateMB).toBe(RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB + 50)
  })

  it('stays quiet below the mark, when the host reports null, or on a bridge without the reader', async () => {
    for (const gpuPrivateMB of [RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB - 1, null, undefined]) {
      resetRendererMemorySampling()
      installCrashReportsApi(gpuPrivateMB)
      await sampleTwice()
    }
    expect(signals).toEqual([])
  })
})
