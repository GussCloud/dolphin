import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../db'
import { HEAVY_JOB_LEASE_TTL_MS } from '../../../../../shared/heavy-job-queue'
import {
  acquireHeavyJobLease,
  heartbeatHeavyJobLease,
  releaseHeavyJobLease
} from './heavy-job-lease-store'

describe('heavy job lease store', () => {
  let orchestration: OrchestrationDb
  const queueKey = 'host|/repo/.git'

  beforeEach(() => {
    orchestration = new OrchestrationDb(':memory:')
  })
  afterEach(() => {
    orchestration.close()
  })

  function acquire(nowMs: number, ticket?: string, limit = 1, key = queueKey) {
    return acquireHeavyJobLease(orchestration.db, {
      queueKey: key,
      holder: 'test',
      ticket,
      limit,
      nowMs
    })
  }

  it('grants the first job and queues the rest in arrival order', () => {
    const first = acquire(1_000)
    const second = acquire(1_001)
    const third = acquire(1_002)
    expect(first).toMatchObject({ granted: true, ahead: 0 })
    expect(second).toMatchObject({ granted: false, ahead: 1 })
    expect(third).toMatchObject({ granted: false, ahead: 2 })

    // The later waiter polling first must not jump the line.
    expect(acquire(1_010, third.ticket)).toMatchObject({ granted: false, ahead: 2 })
    expect(releaseHeavyJobLease(orchestration.db, first.ticket)).toBe(true)
    expect(acquire(1_020, third.ticket)).toMatchObject({ granted: false, ahead: 1 })
    expect(acquire(1_021, second.ticket)).toMatchObject({ granted: true, ahead: 0 })
  })

  it('runs up to the concurrency limit at once', () => {
    expect(acquire(1_000, undefined, 2).granted).toBe(true)
    expect(acquire(1_001, undefined, 2).granted).toBe(true)
    expect(acquire(1_002, undefined, 2)).toMatchObject({ granted: false, ahead: 2 })
  })

  it('keeps separate queues per host and repository', () => {
    expect(acquire(1_000).granted).toBe(true)
    expect(acquire(1_001, undefined, 1, 'host|/other/.git').granted).toBe(true)
  })

  it('re-acquiring with a granted ticket is idempotent', () => {
    const first = acquire(1_000)
    expect(acquire(1_005, first.ticket)).toEqual({ ticket: first.ticket, granted: true, ahead: 0 })
  })

  it('reclaims the slot of a holder that stopped heartbeating', () => {
    const dead = acquire(1_000)
    const waiter = acquire(1_001)
    expect(heartbeatHeavyJobLease(orchestration.db, { ticket: dead.ticket, nowMs: 30_000 })).toBe(
      true
    )
    const afterTtl = 30_000 + HEAVY_JOB_LEASE_TTL_MS
    expect(acquire(afterTtl - 1, waiter.ticket).granted).toBe(false)
    expect(acquire(afterTtl, waiter.ticket)).toMatchObject({ granted: true, ahead: 0 })
    expect(heartbeatHeavyJobLease(orchestration.db, { ticket: dead.ticket, nowMs: afterTtl })).toBe(
      false
    )
  })

  it('sends a waiter that stopped polling to the back of the line', () => {
    const holder = acquire(1_000)
    const lapsed = acquire(1_001)
    heartbeatHeavyJobLease(orchestration.db, {
      ticket: holder.ticket,
      nowMs: 1_000 + HEAVY_JOB_LEASE_TTL_MS - 1
    })
    const fresh = acquire(1_002 + HEAVY_JOB_LEASE_TTL_MS)
    expect(fresh).toMatchObject({ granted: false, ahead: 1 })
    expect(acquire(1_003 + HEAVY_JOB_LEASE_TTL_MS, lapsed.ticket)).toMatchObject({
      ticket: lapsed.ticket,
      granted: false,
      ahead: 2
    })
  })
})
