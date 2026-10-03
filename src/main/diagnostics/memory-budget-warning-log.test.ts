import { describe, expect, it, vi } from 'vitest'
import type { MemoryBudgetWarning } from '../../shared/process-stats-types'
import { createMemoryBudgetWarningLog } from './memory-budget-warning-log'

const MB = 1024 * 1024

function warning(subject: string, megabytes: number): MemoryBudgetWarning {
  return { kind: 'session', subject, bytes: megabytes * MB, limitBytes: 1024 * MB }
}

describe('createMemoryBudgetWarningLog', () => {
  it('logs an owner once when it goes over and once when it clears', () => {
    const emit = vi.fn()
    const log = createMemoryBudgetWarningLog(emit)

    log.observe([warning('wt / a', 1500)])
    log.observe([warning('wt / a', 1600)])
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenLastCalledWith({
      state: 'over',
      kind: 'session',
      subject: 'wt / a',
      megabytes: 1500,
      limitMegabytes: 1024
    })

    log.observe([warning('wt / b', 2048)])
    expect(emit).toHaveBeenCalledTimes(3)
    expect(emit.mock.calls.map(([entry]) => [entry.state, entry.subject])).toEqual([
      ['over', 'wt / a'],
      ['over', 'wt / b'],
      ['cleared', 'wt / a']
    ])

    log.observe([])
    expect(emit).toHaveBeenLastCalledWith({
      state: 'cleared',
      kind: 'session',
      subject: 'wt / b',
      limitMegabytes: 1024
    })
  })

  it('keys owners by kind as well as subject', () => {
    const emit = vi.fn()
    const log = createMemoryBudgetWarningLog(emit)
    log.observe([
      { kind: 'renderer', subject: 'x', bytes: 2000 * MB, limitBytes: 1500 * MB },
      { kind: 'daemon', subject: 'x', bytes: 600 * MB, limitBytes: 512 * MB }
    ])
    expect(emit).toHaveBeenCalledTimes(2)
  })
})
