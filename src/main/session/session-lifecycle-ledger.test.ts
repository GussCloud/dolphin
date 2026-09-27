import { describe, expect, it } from 'vitest'
import { SessionLifecycleLedger } from './session-lifecycle-ledger'

function ledger() {
  let now = 0
  return new SessionLifecycleLedger(() => ++now)
}

describe('SessionLifecycleLedger', () => {
  it('records timestamps for every transition of a full life', () => {
    const l = ledger()
    for (const state of ['running', 'stopping', 'terminated', 'reaped'] as const) {
      expect(l.transition('a', state)).toBe(true)
    }

    expect(l.get('a')?.transitions).toEqual([
      { state: 'running', at: 1 },
      { state: 'stopping', at: 2 },
      { state: 'terminated', at: 3 },
      { state: 'reaped', at: 4 }
    ])
  })

  it('keeps repeated stops idempotent', () => {
    const l = ledger()
    l.transition('a', 'running')

    expect(l.transition('a', 'stopping')).toBe(true)
    expect(l.transition('a', 'stopping')).toBe(true)
    expect(l.transition('a', 'stopping')).toBe(true)
    expect(l.get('a')?.transitions).toHaveLength(2)
    expect(l.get('a')?.rejectedTransitions).toBe(0)
  })

  it('refuses a forbidden transition without throwing and counts it', () => {
    const l = ledger()
    l.transition('a', 'running')
    l.transition('a', 'stopping')

    expect(l.transition('a', 'idle')).toBe(false)
    expect(l.get('a')?.state).toBe('stopping')
    expect(l.get('a')?.rejectedTransitions).toBe(1)
  })

  it('starts a fresh life when a reaped id is spawned again', () => {
    const l = ledger()
    l.transition('a', 'running')
    l.transition('a', 'terminated')
    l.transition('a', 'reaped')

    expect(l.transition('a', 'running')).toBe(true)
    expect(l.get('a')?.transitions.map((t) => t.state)).toEqual(['running'])
  })

  it('bounds how many reaped sessions it remembers', () => {
    const l = ledger()
    for (let i = 0; i < 250; i++) {
      l.transition(`s${i}`, 'running')
      l.transition(`s${i}`, 'terminated')
      l.transition(`s${i}`, 'reaped')
    }
    l.transition('live', 'running')

    expect(l.countByState()).toEqual({ reaped: 200, running: 1 })
    expect(l.get('s0')).toBeUndefined()
  })
})
