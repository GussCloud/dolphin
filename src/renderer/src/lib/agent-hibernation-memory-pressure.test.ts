import { describe, expect, it } from 'vitest'
import {
  classifyHostMemoryPressure,
  getMemoryPressureIdleMs,
  getSessionMemoryByPaneKey,
  orderByHeaviestSession
} from './agent-hibernation-memory-pressure'

const GIB = 1024 * 1024 * 1024
const MINUTE = 60_000

describe('host memory pressure', () => {
  it.each([
    [16 * GIB, 4 * GIB, 'none'],
    [16 * GIB, 3 * GIB, 'elevated'],
    [16 * GIB, 1.5 * GIB, 'critical'],
    // Large hosts are capped in bytes, not ratio: 10 GiB free of 128 GiB is not pressure.
    [128 * GIB, 10 * GIB, 'none'],
    [128 * GIB, 3 * GIB, 'elevated'],
    [128 * GIB, 1 * GIB, 'critical'],
    [8 * GIB, 0.7 * GIB, 'critical']
  ] as const)('classifies %d total / %d available as %s', (totalMemory, availableMemory, level) => {
    expect(classifyHostMemoryPressure({ totalMemory, availableMemory })).toBe(level)
  })

  it('treats unknown or malformed host memory as no pressure', () => {
    expect(classifyHostMemoryPressure(null)).toBe('none')
    expect(classifyHostMemoryPressure(undefined)).toBe('none')
    expect(classifyHostMemoryPressure({ totalMemory: 0, availableMemory: 0 })).toBe('none')
    expect(classifyHostMemoryPressure({ totalMemory: Number.NaN, availableMemory: 1 })).toBe('none')
    expect(classifyHostMemoryPressure({ totalMemory: 16 * GIB, availableMemory: -1 })).toBe('none')
  })

  it('shortens the idle window toward the floor without ever lengthening it', () => {
    expect(getMemoryPressureIdleMs(30 * MINUTE, 'none', MINUTE)).toBe(30 * MINUTE)
    expect(getMemoryPressureIdleMs(30 * MINUTE, 'elevated', MINUTE)).toBe(7.5 * MINUTE)
    expect(getMemoryPressureIdleMs(30 * MINUTE, 'critical', MINUTE)).toBe(MINUTE)
    expect(getMemoryPressureIdleMs(2 * MINUTE, 'elevated', MINUTE)).toBe(MINUTE)
    // A user window already at the floor stays there.
    expect(getMemoryPressureIdleMs(MINUTE, 'critical', MINUTE)).toBe(MINUTE)
  })

  it('sums session memory per pane and ignores unattributed sessions', () => {
    const session = (paneKey: string | null, memory: number) => ({
      sessionId: `s-${paneKey}-${memory}`,
      paneKey,
      pid: 1,
      cpu: 0,
      memory
    })
    const byPane = getSessionMemoryByPaneKey({
      worktrees: [
        {
          worktreeId: 'wt',
          worktreeName: 'wt',
          repoId: 'r',
          repoName: 'r',
          cpu: 0,
          memory: 0,
          history: [],
          sessions: [session('a', 100), session('a', 50), session(null, 999), session('b', 0)]
        }
      ]
    })
    expect([...byPane]).toEqual([['a', 150]])
    expect(getSessionMemoryByPaneKey(null).size).toBe(0)
  })

  it('orders the heaviest sessions first and keeps unknown ones last in plan order', () => {
    const candidates = ['light', 'unknown-1', 'heavy', 'unknown-2'].map((paneKey) => ({ paneKey }))
    const memory = new Map([
      ['light', 10],
      ['heavy', 900]
    ])
    expect(orderByHeaviestSession(candidates, memory).map((c) => c.paneKey)).toEqual([
      'heavy',
      'light',
      'unknown-1',
      'unknown-2'
    ])
  })
})
