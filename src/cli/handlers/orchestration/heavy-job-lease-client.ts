import { hostname } from 'node:os'
import type { RuntimeClient } from '../../runtime-client'
import {
  HEAVY_JOB_ACQUIRE_LONG_POLL_MS,
  HEAVY_JOB_HEARTBEAT_INTERVAL_MS,
  type HeavyJobAcquireResult
} from '../../../shared/heavy-job-queue'

// Why: the long poll must outlive its own budget on the wire, or the client times out first.
const ACQUIRE_TRANSPORT_GRACE_MS = 15_000

export type HeavyJobSlot =
  | { kind: 'granted'; ticket: string; waitedMs: number; queuedBehind: number }
  | { kind: 'timed_out'; waitedMs: number; queuedBehind: number }
  | { kind: 'unavailable'; reason: string }

/** Blocks until this job holds a slot, the wait budget runs out, or the host has no queue. */
export async function acquireHeavyJobSlot(
  client: RuntimeClient,
  input: { queueKey: string; command: readonly string[]; maxWaitMs: number },
  onQueued: (ahead: number) => void
): Promise<HeavyJobSlot> {
  const startedAt = Date.now()
  const deadline = startedAt + input.maxWaitMs
  const holder = `${hostname()} pid ${process.pid}: ${input.command.join(' ')}`.slice(0, 200)
  let ticket: string | undefined
  let queuedBehind = 0
  for (;;) {
    const waitMs = Math.max(0, Math.min(HEAVY_JOB_ACQUIRE_LONG_POLL_MS, deadline - Date.now()))
    let result: HeavyJobAcquireResult
    try {
      result = (
        await client.call<HeavyJobAcquireResult>(
          'orchestration.heavyJobAcquire',
          { queueKey: input.queueKey, holder, ticket, waitMs },
          { timeoutMs: waitMs + ACQUIRE_TRANSPORT_GRACE_MS }
        )
      ).result
    } catch (error) {
      if (ticket) {
        void releaseHeavyJobSlot(client, ticket)
      }
      return { kind: 'unavailable', reason: describeUnavailable(error) }
    }
    ticket = result.ticket
    if (result.granted) {
      return { kind: 'granted', ticket, waitedMs: Date.now() - startedAt, queuedBehind }
    }
    if (queuedBehind === 0) {
      queuedBehind = result.ahead
      onQueued(result.ahead)
    }
    if (Date.now() >= deadline) {
      await releaseHeavyJobSlot(client, ticket)
      return { kind: 'timed_out', waitedMs: Date.now() - startedAt, queuedBehind }
    }
  }
}

/** Keeps the lease alive while the job runs; a lost lease never stops the job. */
export function startHeavyJobHeartbeat(client: RuntimeClient, ticket: string): () => void {
  const timer = setInterval(() => {
    client.call('orchestration.heavyJobHeartbeat', { ticket }).catch(() => undefined)
  }, HEAVY_JOB_HEARTBEAT_INTERVAL_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}

export async function releaseHeavyJobSlot(client: RuntimeClient, ticket: string): Promise<void> {
  // Why: an unreachable host reclaims the lease by TTL, so a failed release is not an error.
  await client.call('orchestration.heavyJobRelease', { ticket }).catch(() => undefined)
}

function describeUnavailable(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined
  if (code === 'method_not_found') {
    return 'the Dolphin runtime predates the heavy-job queue'
  }
  return error instanceof Error ? error.message : String(error)
}
