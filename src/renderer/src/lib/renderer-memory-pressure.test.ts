import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RENDERER_MEMORY_PRESSURE_COOLDOWN_MS,
  RENDERER_MEMORY_PRESSURE_GPU_MB,
  noteRendererMemoryPressureSample,
  readRendererMemoryPressure,
  resetRendererMemoryPressureForTest,
  subscribeRendererMemoryPressure
} from './renderer-memory-pressure'

describe('renderer memory pressure', () => {
  afterEach(() => {
    resetRendererMemoryPressureForTest()
  })

  it('reads pressure at the top heap or footprint mark and nothing below', () => {
    expect(readRendererMemoryPressure({ heapRatio: 0.79, privateMB: 999 })).toBeNull()
    expect(readRendererMemoryPressure({ heapRatio: null, privateMB: null })).toBeNull()
    expect(readRendererMemoryPressure({ heapRatio: 0.8, privateMB: 100 })?.trigger).toBe('heap')
    expect(readRendererMemoryPressure({ heapRatio: 0.1, privateMB: 1000 })?.trigger).toBe('private')
  })

  it("reads GPU-process pressure only at its own metric's mark, and renderer marks first", () => {
    const calm = { heapRatio: 0.1, privateMB: 100 }
    expect(readRendererMemoryPressure({ ...calm, gpu: null })).toBeNull()
    for (const metric of ['private-bytes', 'physical-footprint'] as const) {
      const mark = RENDERER_MEMORY_PRESSURE_GPU_MB[metric]
      expect(readRendererMemoryPressure({ ...calm, gpu: { metric, mb: mark - 1 } })).toBeNull()
      expect(readRendererMemoryPressure({ ...calm, gpu: { metric, mb: mark } })?.trigger).toBe(
        'gpu'
      )
    }
    expect(
      readRendererMemoryPressure({
        heapRatio: 0.9,
        privateMB: 100,
        gpu: { metric: 'private-bytes', mb: 900 }
      })?.trigger
    ).toBe('heap')
  })

  it('never holds a macOS footprint against the Windows private-bytes mark', () => {
    const calm = { heapRatio: 0.1, privateMB: 100 }
    // Why 1130: the top of the steady single-window GPU footprint measured on a Mac.
    expect(
      readRendererMemoryPressure({ ...calm, gpu: { metric: 'physical-footprint', mb: 1130 } })
    ).toBeNull()
    expect(
      readRendererMemoryPressure({ ...calm, gpu: { metric: 'private-bytes', mb: 1130 } })?.trigger
    ).toBe('gpu')
    expect(RENDERER_MEMORY_PRESSURE_GPU_MB['physical-footprint']).toBeGreaterThan(
      RENDERER_MEMORY_PRESSURE_GPU_MB['private-bytes']
    )
  })

  it('keeps GPU and renderer cool-downs apart so a GPU shed never delays a heap shed', () => {
    const gpuHigh = {
      heapRatio: 0.1,
      privateMB: null,
      gpu: { metric: 'private-bytes', mb: 500 }
    } as const
    const heapHigh = { heapRatio: 0.9, privateMB: null }
    expect(noteRendererMemoryPressureSample(gpuHigh, 0)?.trigger).toBe('gpu')
    expect(noteRendererMemoryPressureSample(heapHigh, 1)?.trigger).toBe('heap')
    expect(noteRendererMemoryPressureSample(gpuHigh, 2)).toBeNull()
    expect(
      noteRendererMemoryPressureSample(gpuHigh, RENDERER_MEMORY_PRESSURE_COOLDOWN_MS)
    ).not.toBe(null)
  })

  it('notifies every listener at most once per cool-down', () => {
    const first = vi.fn()
    const failing = vi.fn(() => {
      throw new Error('responder failed')
    })
    const last = vi.fn()
    subscribeRendererMemoryPressure(first)
    subscribeRendererMemoryPressure(failing)
    const unsubscribe = subscribeRendererMemoryPressure(last)
    const high = { heapRatio: 0.9, privateMB: null }

    expect(noteRendererMemoryPressureSample(high, 0)).not.toBeNull()
    expect(first).toHaveBeenCalledTimes(1)
    expect(last).toHaveBeenCalledTimes(1)

    expect(noteRendererMemoryPressureSample(high, RENDERER_MEMORY_PRESSURE_COOLDOWN_MS - 1)).toBe(
      null
    )
    expect(noteRendererMemoryPressureSample({ heapRatio: 0.1, privateMB: null }, 10e9)).toBeNull()

    unsubscribe()
    expect(noteRendererMemoryPressureSample(high, RENDERER_MEMORY_PRESSURE_COOLDOWN_MS)).not.toBe(
      null
    )
    expect(first).toHaveBeenCalledTimes(2)
    expect(last).toHaveBeenCalledTimes(1)
  })
})
