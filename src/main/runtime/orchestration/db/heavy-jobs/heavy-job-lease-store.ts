import type Database from '../../../../sqlite/sync-database'
import {
  HEAVY_JOB_LEASE_TTL_MS,
  type HeavyJobAcquireResult
} from '../../../../../shared/heavy-job-queue'
import { generateId } from '../generated-id'

type LeaseRow = { ticket: string; state: 'waiting' | 'running'; enqueued_ms: number; seq: number }

/**
 * Takes a slot, or a FIFO place in line, for one heavy job. Re-calling with the returned ticket
 * keeps the place; a ticket whose holder stopped calling has expired and queues again at the back.
 */
export function acquireHeavyJobLease(
  db: Database.Database,
  input: { queueKey: string; ticket?: string; holder: string; limit: number; nowMs: number }
): HeavyJobAcquireResult {
  const expiresMs = input.nowMs + HEAVY_JOB_LEASE_TTL_MS
  db.exec('SAVEPOINT heavy_job_acquire')
  try {
    db.prepare('DELETE FROM heavy_job_leases WHERE queue_key = ? AND expires_ms <= ?').run(
      input.queueKey,
      input.nowMs
    )
    let row = input.ticket ? readLease(db, input.queueKey, input.ticket) : undefined
    if (row) {
      db.prepare('UPDATE heavy_job_leases SET expires_ms = ? WHERE ticket = ?').run(
        expiresMs,
        row.ticket
      )
    } else {
      const ticket = input.ticket ?? generateId('hjob')
      db.prepare(
        `INSERT INTO heavy_job_leases (ticket, queue_key, state, holder, enqueued_ms, expires_ms)
         VALUES (?, ?, 'waiting', ?, ?, ?)`
      ).run(ticket, input.queueKey, input.holder, input.nowMs, expiresMs)
      row = readLease(db, input.queueKey, ticket)!
    }
    let result: HeavyJobAcquireResult
    if (row.state === 'running') {
      result = { ticket: row.ticket, granted: true, ahead: 0 }
    } else {
      const ahead = countAhead(db, input.queueKey, row)
      const granted = ahead < Math.max(1, input.limit)
      if (granted) {
        db.prepare("UPDATE heavy_job_leases SET state = 'running' WHERE ticket = ?").run(row.ticket)
      }
      result = { ticket: row.ticket, granted, ahead }
    }
    db.exec('RELEASE heavy_job_acquire')
    return result
  } catch (error) {
    db.exec('ROLLBACK TO heavy_job_acquire; RELEASE heavy_job_acquire')
    throw error
  }
}

/** False when the lease already expired and was reclaimed; the holder keeps running regardless. */
export function heartbeatHeavyJobLease(
  db: Database.Database,
  input: { ticket: string; nowMs: number }
): boolean {
  const result = db
    .prepare(
      "UPDATE heavy_job_leases SET expires_ms = ? WHERE ticket = ? AND state = 'running' AND expires_ms > ?"
    )
    .run(input.nowMs + HEAVY_JOB_LEASE_TTL_MS, input.ticket, input.nowMs)
  return Number(result.changes) > 0
}

export function releaseHeavyJobLease(db: Database.Database, ticket: string): boolean {
  const result = db.prepare('DELETE FROM heavy_job_leases WHERE ticket = ?').run(ticket)
  return Number(result.changes) > 0
}

function readLease(db: Database.Database, queueKey: string, ticket: string): LeaseRow | undefined {
  const row = db
    .prepare(
      `SELECT ticket, state, enqueued_ms, rowid AS seq FROM heavy_job_leases
       WHERE ticket = ? AND queue_key = ?`
    )
    .get(ticket, queueKey)
  return row
    ? {
        ticket: String(row.ticket),
        state: row.state === 'running' ? 'running' : 'waiting',
        enqueued_ms: Number(row.enqueued_ms),
        seq: Number(row.seq)
      }
    : undefined
}

function countAhead(db: Database.Database, queueKey: string, row: LeaseRow): number {
  const counted = db
    .prepare(
      `SELECT COUNT(*) AS n FROM heavy_job_leases
       WHERE queue_key = ? AND (state = 'running'
         OR enqueued_ms < ? OR (enqueued_ms = ? AND rowid < ?))`
    )
    .get(queueKey, row.enqueued_ms, row.enqueued_ms, row.seq)
  return Number(counted?.n ?? 0)
}
