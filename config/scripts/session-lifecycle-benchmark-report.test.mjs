import { describe, expect, it } from 'vitest'
import {
  evaluateChurn,
  evaluateSoak,
  summarizeSample
} from './session-lifecycle-benchmark-report.mjs'

const MB = 1024 * 1024

function diag({ ptys = 0, daemon = 0, orphans = 0, tracked = 0, untracked = 0, renderer = 100 }) {
  return {
    collectedAt: 1,
    sessions: {
      registeredPtyCount: ptys,
      daemonSessionCount: daemon,
      inconsistencies: Array.from({ length: orphans }, () => ({ kind: 'daemon-session-orphaned' }))
    },
    memory: {
      trackedProcessCount: tracked,
      daemon: { memory: 50 * MB, untrackedDescendantCount: untracked },
      app: { renderer: { memory: renderer * MB }, main: { memory: 80 * MB } }
    },
    storage: { totalBytes: 0 }
  }
}

describe('evaluateChurn', () => {
  it('passes when counts return to baseline', () => {
    const verdict = evaluateChurn(
      summarizeSample(diag({ ptys: 2, daemon: 2, tracked: 4 })),
      summarizeSample(diag({ ptys: 2, daemon: 2, tracked: 4, renderer: 140 }))
    )

    expect(verdict.passed).toBe(true)
    expect(verdict.delta.rendererBytes).toBe(40 * MB)
  })

  it('fails on leaked sessions, processes, or orphans', () => {
    const verdict = evaluateChurn(
      summarizeSample(diag({})),
      summarizeSample(diag({ ptys: 1, daemon: 3, orphans: 2, tracked: 5, untracked: 1 }))
    )

    expect(verdict.passed).toBe(false)
    expect(verdict.failures).toHaveLength(5)
  })
})

describe('evaluateSoak', () => {
  it('judges memory growth after warm-up only', () => {
    const samples = [100, 200, 205, 210].map((renderer) => summarizeSample(diag({ renderer })))

    const verdict = evaluateSoak(samples, { warmupSamples: 1, maxGrowthRatio: 0.1 })

    expect(verdict.passed).toBe(true)
    expect(verdict.growth.rendererBytes).toBeCloseTo(0.05)
  })

  it('fails on unbounded growth', () => {
    const samples = [100, 100, 150].map((renderer) => summarizeSample(diag({ renderer })))

    expect(evaluateSoak(samples, { warmupSamples: 0 }).failures).toEqual([
      'rendererBytes grew 50.0% after warm-up'
    ])
  })
})
