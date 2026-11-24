import { describe, expect, it } from 'vitest'
import { getProcessMemoryMetric } from './process-memory-metric'

describe('process memory metric', () => {
  it('declares RSS for Unix process sweeps', () => {
    expect(getProcessMemoryMetric('darwin')).toBe('rss')
    expect(getProcessMemoryMetric('linux')).toBe('rss')
  })

  it('declares working set for Windows process sweeps', () => {
    expect(getProcessMemoryMetric('win32')).toBe('working-set')
  })
})

describe('process memory metric with a footprint sweep', () => {
  it('declares footprint only when the sweep carried footprint bytes', () => {
    expect(getProcessMemoryMetric('darwin', true)).toBe('footprint')
    expect(getProcessMemoryMetric('darwin', false)).toBe('rss')
  })
})
