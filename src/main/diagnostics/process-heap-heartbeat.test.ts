import { afterEach, describe, expect, it, vi } from 'vitest'
import { isProcessHeapSample, type ProcessHeapSample } from '../../shared/process-heap-sample'
import {
  formatProcessHeapHeartbeatFields,
  PROCESS_HEAP_HEARTBEAT_INTERVAL_MS,
  readProcessHeapSample,
  startProcessHeapHeartbeat
} from './process-heap-heartbeat'

const MB = 1024 * 1024
const sample: ProcessHeapSample = {
  rssBytes: 300 * MB,
  heapUsedBytes: 120.26 * MB,
  heapTotalBytes: 160 * MB,
  externalBytes: 8 * MB,
  arrayBuffersBytes: 2 * MB,
  heapLimitBytes: 2048 * MB
}

afterEach(() => {
  vi.useRealTimers()
})

describe('readProcessHeapSample', () => {
  it('reports this process as a valid sample with a V8 ceiling', () => {
    const own = readProcessHeapSample()
    expect(isProcessHeapSample(own)).toBe(true)
    expect(own.heapUsedBytes).toBeGreaterThan(0)
    expect(own.heapLimitBytes).toBeGreaterThan(own.heapUsedBytes)
  })
})

describe('isProcessHeapSample', () => {
  it('accepts a sample without a ceiling and rejects malformed payloads', () => {
    const { heapLimitBytes: _omitted, ...withoutLimit } = sample
    expect(isProcessHeapSample(withoutLimit)).toBe(true)
    expect(isProcessHeapSample({ ...sample, rssBytes: -1 })).toBe(false)
    expect(isProcessHeapSample({ ...sample, heapUsedBytes: '1' })).toBe(false)
    expect(isProcessHeapSample({ ...sample, heapLimitBytes: Number.NaN })).toBe(false)
    expect(isProcessHeapSample(null)).toBe(false)
  })
})

describe('formatProcessHeapHeartbeatFields', () => {
  it('rounds to one-decimal megabytes and omits unknowns', () => {
    expect(formatProcessHeapHeartbeatFields(sample, 7)).toEqual({
      rssMb: 300,
      heapUsedMb: 120.3,
      heapTotalMb: 160,
      externalMb: 8,
      arrayBuffersMb: 2,
      heapLimitMb: 2048,
      sessionCount: 7
    })
    const { heapLimitBytes: _omitted, ...withoutLimit } = sample
    const fields = formatProcessHeapHeartbeatFields(withoutLimit, null)
    expect(fields).not.toHaveProperty('heapLimitMb')
    expect(fields).not.toHaveProperty('sessionCount')
  })
})

describe('startProcessHeapHeartbeat', () => {
  it('emits once per interval until stopped', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const stop = startProcessHeapHeartbeat({
      emit,
      readSessionCount: () => 3,
      readSample: () => sample
    })
    vi.advanceTimersByTime(PROCESS_HEAP_HEARTBEAT_INTERVAL_MS - 1)
    expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit.mock.calls[0][0]).toMatchObject({ heapUsedMb: 120.3, sessionCount: 3 })
    stop()
    vi.advanceTimersByTime(PROCESS_HEAP_HEARTBEAT_INTERVAL_MS * 3)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('still logs the heap when the session count throws, and never throws itself', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const stop = startProcessHeapHeartbeat({
      emit,
      intervalMs: 1000,
      readSessionCount: () => {
        throw new Error('inventory unavailable')
      },
      readSample: () => sample
    })
    vi.advanceTimersByTime(1000)
    expect(emit.mock.calls[0][0]).not.toHaveProperty('sessionCount')

    emit.mockImplementation(() => {
      throw new Error('log disk full')
    })
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    stop()
  })
})
