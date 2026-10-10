import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RENDERER_MEMORY_PRESSURE_COOLDOWN_MS,
  RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB,
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

  it('reads GPU-process pressure only at its own mark, and renderer marks first', () => {
    const calm = { heapRatio: 0.1, privateMB: 100 }
    expect(readRendererMemoryPressure({ ...calm, gpuPrivateMB: null })).toBeNull()
    expect(
      readRendererMemoryPressure({
        ...calm,
        gpuPrivateMB: RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB - 1
      })
    ).toBeNull()
    expect(
      readRendererMemoryPressure({ ...calm, gpuPrivateMB: RENDERER_MEMORY_PRESSURE_GPU_PRIVATE_MB })
        ?.trigger
    ).toBe('gpu')
    expect(
      readRendererMemoryPressure({ heapRatio: 0.9, privateMB: 100, gpuPrivateMB: 900 })?.trigger
    ).toBe('heap')
  })

  it('keeps GPU and renderer cool-downs apart so a GPU shed never delays a heap shed', () => {
    const gpuHigh = { heapRatio: 0.1, privateMB: null, gpuPrivateMB: 500 }
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
