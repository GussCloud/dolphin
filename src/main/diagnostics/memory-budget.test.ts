import { describe, expect, it } from 'vitest'
import type { MemorySnapshot } from '../../shared/process-stats-types'
import { DEFAULT_MEMORY_BUDGET, evaluateMemoryBudget, readMemoryBudget } from './memory-budget'

const MB = 1024 * 1024
const usage = { cpu: 0, memory: 0 }

function snapshot(overrides: {
  renderer?: number
  daemon?: number
  session?: { memory: number; privateMemory?: number }
}): MemorySnapshot {
  return {
    app: {
      ...usage,
      main: usage,
      renderer: { cpu: 0, memory: overrides.renderer ?? 0 },
      other: usage,
      history: []
    },
    worktrees: overrides.session
      ? [
          {
            ...usage,
            worktreeId: 'w',
            worktreeName: 'feature',
            repoId: 'r',
            repoName: 'repo',
            history: [],
            sessions: [{ cpu: 0, sessionId: 's1', paneKey: null, pid: 1, ...overrides.session }]
          }
        ]
      : [],
    host: {
      totalMemory: 0,
      freeMemory: 0,
      availableMemory: 0,
      availableMemorySource: 'free-memory',
      usedMemory: 0,
      memoryUsagePercent: 0,
      cpuCoreCount: 1,
      loadAverage1m: 0
    },
    processMemoryMetric: 'rss',
    totalCpu: 0,
    totalMemory: 0,
    ...(overrides.daemon === undefined
      ? {}
      : { daemon: { pid: 9, cpu: 0, memory: overrides.daemon, untrackedDescendantCount: 0 } }),
    collectedAt: 0
  }
}

describe('evaluateMemoryBudget', () => {
  it('is quiet under budget', () => {
    expect(
      evaluateMemoryBudget(
        snapshot({ renderer: 100 * MB, daemon: 10 * MB, session: { memory: 10 * MB } }),
        DEFAULT_MEMORY_BUDGET
      )
    ).toEqual([])
  })

  it('warns for each owner over budget', () => {
    const warnings = evaluateMemoryBudget(
      snapshot({ renderer: 2000 * MB, daemon: 600 * MB, session: { memory: 2000 * MB } }),
      DEFAULT_MEMORY_BUDGET
    )

    expect(warnings.map((w) => [w.kind, w.subject])).toEqual([
      ['renderer', 'renderer'],
      ['daemon', 'pid 9'],
      ['session', 'feature / s1']
    ])
  })

  it('judges a session by committed bytes when its working set was trimmed', () => {
    const warnings = evaluateMemoryBudget(
      snapshot({ session: { memory: 50 * MB, privateMemory: 1500 * MB } }),
      DEFAULT_MEMORY_BUDGET
    )

    expect(warnings).toEqual([expect.objectContaining({ kind: 'session', bytes: 1500 * MB })])
  })
})

describe('readMemoryBudget', () => {
  it('reads megabyte overrides and ignores invalid ones', () => {
    expect(
      readMemoryBudget({
        DOLPHIN_WARN_RENDERER_MEMORY_MB: '800',
        DOLPHIN_WARN_DAEMON_MEMORY_MB: 'nope'
      })
    ).toEqual({ ...DEFAULT_MEMORY_BUDGET, rendererBytes: 800 * MB })
  })
})
