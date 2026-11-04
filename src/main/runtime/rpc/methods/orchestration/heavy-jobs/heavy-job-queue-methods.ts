import { defineMethod } from '../../../core'
import {
  HeavyJobAcquireParams,
  HeavyJobTicketParams
} from '../../../../../../shared/rpc-contract/heavy-job-queue-params'
import {
  HEAVY_JOB_ACQUIRE_LONG_POLL_MS,
  HEAVY_JOB_DEFAULT_CONCURRENCY
} from '../../../../../../shared/heavy-job-queue'
import {
  acquireHeavyJobLease,
  heartbeatHeavyJobLease,
  releaseHeavyJobLease
} from '../../../../orchestration/db/heavy-jobs/heavy-job-lease-store'

// Why: wakes long-polling waiters on release so a freed slot is taken at once, not at the next poll.
const releaseListeners = new Set<() => void>()

function waitForRelease(waitMs: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer)
      releaseListeners.delete(finish)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, waitMs)
    releaseListeners.add(finish)
    signal?.addEventListener('abort', finish, { once: true })
  })
}

export const ORCHESTRATION_HEAVY_JOB_METHODS = [
  defineMethod({
    name: 'orchestration.heavyJobAcquire',
    params: HeavyJobAcquireParams,
    handler: async (params, { runtime, signal }) => {
      const db = runtime.getOrchestrationDb().db
      const acquire = (ticket: string | undefined) =>
        acquireHeavyJobLease(db, {
          queueKey: params.queueKey,
          holder: params.holder,
          ticket,
          limit: HEAVY_JOB_DEFAULT_CONCURRENCY,
          nowMs: Date.now()
        })
      const first = acquire(params.ticket)
      const waitMs = Math.min(Math.max(0, params.waitMs ?? 0), HEAVY_JOB_ACQUIRE_LONG_POLL_MS)
      if (first.granted || waitMs === 0) {
        return first
      }
      await waitForRelease(waitMs, signal)
      return acquire(first.ticket)
    }
  }),
  defineMethod({
    name: 'orchestration.heavyJobHeartbeat',
    params: HeavyJobTicketParams,
    handler: (params, { runtime }) => ({
      held: heartbeatHeavyJobLease(runtime.getOrchestrationDb().db, {
        ticket: params.ticket,
        nowMs: Date.now()
      })
    })
  }),
  defineMethod({
    name: 'orchestration.heavyJobRelease',
    params: HeavyJobTicketParams,
    handler: (params, { runtime }) => {
      const released = releaseHeavyJobLease(runtime.getOrchestrationDb().db, params.ticket)
      for (const wake of releaseListeners) {
        wake()
      }
      return { released }
    }
  })
]
