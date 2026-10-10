// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ releaseAllRetainedHiddenWebgl: vi.fn(() => 3) }))

vi.mock('@/lib/pane-manager/terminal-webgl-hidden-retention', () => ({
  releaseAllRetainedHiddenWebgl: mocks.releaseAllRetainedHiddenWebgl
}))

vi.mock('@/lib/crash-breadcrumb-recorder', () => ({
  recordRendererCrashBreadcrumb: vi.fn()
}))

import {
  noteRendererMemoryPressureSample,
  resetRendererMemoryPressureForTest
} from '@/lib/renderer-memory-pressure'
import { useTerminalMemoryPressureResponse } from './use-terminal-memory-pressure-response'

describe('useTerminalMemoryPressureResponse', () => {
  afterEach(() => {
    resetRendererMemoryPressureForTest()
    mocks.releaseAllRetainedHiddenWebgl.mockClear()
  })

  it('drops hidden WebGL contexts and requests one shedding parking pass per signal', () => {
    const setRevision = vi.fn()
    const { result, unmount } = renderHook(() => useTerminalMemoryPressureResponse(setRevision))
    expect(result.current.current).toBe(false)

    act(() => {
      noteRendererMemoryPressureSample({ heapRatio: 0.85, privateMB: null }, 0)
    })

    expect(mocks.releaseAllRetainedHiddenWebgl).toHaveBeenCalledTimes(1)
    expect(result.current.current).toBe(true)
    expect(setRevision).toHaveBeenCalledTimes(1)

    unmount()
    noteRendererMemoryPressureSample({ heapRatio: 0.85, privateMB: null }, 10 * 60_000)
    expect(mocks.releaseAllRetainedHiddenWebgl).toHaveBeenCalledTimes(1)
  })

  it('answers GPU-process pressure by dropping WebGL only, without a parking pass', () => {
    const setRevision = vi.fn()
    const { result, unmount } = renderHook(() => useTerminalMemoryPressureResponse(setRevision))

    act(() => {
      noteRendererMemoryPressureSample({ heapRatio: 0.1, privateMB: 100, gpuPrivateMB: 500 }, 0)
    })

    expect(mocks.releaseAllRetainedHiddenWebgl).toHaveBeenCalledTimes(1)
    expect(result.current.current).toBe(false)
    expect(setRevision).not.toHaveBeenCalled()
    unmount()
  })
})
