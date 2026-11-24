// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./crash-breadcrumb-recorder', () => ({ recordRendererCrashBreadcrumb: vi.fn() }))
vi.mock('../components/browser-pane/host-guest/webview-registry', () => ({
  getBrowserWebviewMemoryProfile: () => ({ browserWebviewCount: 0, registeredBrowserGuestCount: 0 })
}))
vi.mock('./renderer-memory-profile', () => ({ collectRendererMemoryProfileCounts: () => ({}) }))

import type { GpuProcessMemoryMetric } from '../../../shared/gpu-process-memory'
import { recordRendererCrashBreadcrumb } from './crash-breadcrumb-recorder'
import {
  RENDERER_MEMORY_PRESSURE_GPU_MB,
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

function installCrashReportsApi(
  gpuMB: number | null | undefined,
  metric: GpuProcessMemoryMetric = 'private-bytes'
): void {
  const crashReports = {
    readHeapStatistics: () => calmHeap,
    readProcessMemory: () => Promise.resolve({ privateKB: 200 * 1024 }),
    ...(gpuMB === undefined
      ? {}
      : {
          readGpuProcessMemory: () =>
            Promise.resolve(gpuMB === null ? null : { metric, kilobytes: gpuMB * 1024 })
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
    const mb = RENDERER_MEMORY_PRESSURE_GPU_MB['private-bytes'] + 50
    installCrashReportsApi(mb)
    await sampleTwice()
    expect(signals.map((signal) => signal.trigger)).toEqual(['gpu'])
    expect(signals[0]?.gpu).toEqual({ metric: 'private-bytes', mb })
  })

  it('judges a macOS footprint by its own mark, not the Windows one', async () => {
    installCrashReportsApi(
      RENDERER_MEMORY_PRESSURE_GPU_MB['private-bytes'] + 50,
      'physical-footprint'
    )
    await sampleTwice()
    expect(signals).toEqual([])
    resetRendererMemorySampling()
    const mb = RENDERER_MEMORY_PRESSURE_GPU_MB['physical-footprint'] + 50
    installCrashReportsApi(mb, 'physical-footprint')
    await sampleTwice()
    expect(signals.map((signal) => signal.gpu)).toEqual([{ metric: 'physical-footprint', mb }])
  })

  it('records a footprint under its own breadcrumb field, never as private bytes', async () => {
    vi.mocked(recordRendererCrashBreadcrumb).mockClear()
    installCrashReportsApi(700, 'physical-footprint')
    await sampleTwice()
    const memoryCrumbs = vi
      .mocked(recordRendererCrashBreadcrumb)
      .mock.calls.filter(([name]) => name === 'renderer_memory')
    expect(memoryCrumbs.at(-1)?.[1]).toMatchObject({ gpuFootprintMB: 700 })
    expect(memoryCrumbs.at(-1)?.[1]).not.toHaveProperty('gpuPrivateMB')
  })

  it('stays quiet below the mark, when the host reports null, or on a bridge without the reader', async () => {
    for (const gpuMB of [RENDERER_MEMORY_PRESSURE_GPU_MB['private-bytes'] - 1, null, undefined]) {
      resetRendererMemorySampling()
      installCrashReportsApi(gpuMB)
      await sampleTwice()
    }
    expect(signals).toEqual([])
  })
})
