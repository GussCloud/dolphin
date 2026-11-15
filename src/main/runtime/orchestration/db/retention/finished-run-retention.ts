// Deletes orchestration runs that finished long ago, with every row they own (tasks, dispatches,
// messages, observation facts and the archived worker terminal output, up to ~256 KB a dispatch).
// Without it the database only shrinks on a manual full reset. Conservative on purpose: a run is
// kept unless it is plainly over and local; anything live, pending, federated or legacy stays.
import type Database from '../../../../sqlite/sync-database'
import { LEGACY_RUN_ID } from '../contract-constants'

export const FINISHED_RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const TERMINAL_TASK_STATUSES = "('completed', 'failed')"
const TERMINAL_DISPATCH_STATES = "('failed', 'succeeded', 'stopped', 'abandoned')"
const RUN_DISPATCHES = 'SELECT id FROM dispatch_contexts WHERE run_id = r.id'

// The cutoff is bound once per `?` below, in order (the driver binds positionally).

const ELIGIBLE_RUNS_SQL = `
SELECT r.id FROM runs r
WHERE r.legacy = 0
  AND r.id != ?
  AND r.home_database = 'this_database'
  AND r.updated_at < ?
  AND NOT EXISTS (
    SELECT 1 FROM tasks t WHERE t.run_id = r.id
      AND (t.status NOT IN ${TERMINAL_TASK_STATUSES}
        OR COALESCE(t.completed_at, t.created_at) >= ?))
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.run_id = r.id AND m.created_at >= ?)
  AND NOT EXISTS (
    SELECT 1 FROM worker_dispatches wd WHERE wd.dispatch_id IN (${RUN_DISPATCHES})
      AND (wd.state NOT IN ${TERMINAL_DISPATCH_STATES} OR wd.updated_at >= ?))
  AND NOT EXISTS (
    SELECT 1 FROM worker_terminal_resources res WHERE res.owner_dispatch_id IN (${RUN_DISPATCHES})
      AND res.release_state != 'released')
  AND NOT EXISTS (SELECT 1 FROM federated_dispatches f WHERE f.dispatch_id IN (${RUN_DISPATCHES}))
  AND NOT EXISTS (
    SELECT 1 FROM remote_dispatch_attachments a
      WHERE a.home_run_id = r.id OR a.dispatch_id IN (${RUN_DISPATCHES}))
  AND NOT EXISTS (
    SELECT 1 FROM federation_relay_items fr WHERE fr.dispatch_id IN (${RUN_DISPATCHES}))
  AND NOT EXISTS (SELECT 1 FROM remote_questions rq WHERE rq.dispatch_id IN (${RUN_DISPATCHES}))
  AND NOT EXISTS (
    SELECT 1 FROM legacy_adoptions la WHERE la.adopted_run_id = r.id OR la.source_run_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM legacy_compatibility_principals p WHERE p.run_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM decision_gates g WHERE g.run_id = r.id AND g.status = 'pending')
  AND NOT EXISTS (SELECT 1 FROM question_threads q WHERE q.run_id = r.id AND q.status = 'pending')
  AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.run_id = r.id AND d.status = 'outstanding')
`

const DISPATCHES_OF_RUN = 'SELECT id FROM dispatch_contexts WHERE run_id = ?'

// Dispatch-owned rows first, while dispatch_contexts still maps them to the run.
const DELETE_RUN_SQL = [
  `DELETE FROM worker_terminal_archives WHERE dispatch_id IN (${DISPATCHES_OF_RUN})`,
  `DELETE FROM attempt_observation_facts WHERE dispatch_id IN (${DISPATCHES_OF_RUN})`,
  `DELETE FROM worker_terminal_resources WHERE owner_dispatch_id IN (${DISPATCHES_OF_RUN})`,
  `DELETE FROM worker_dispatches WHERE dispatch_id IN (${DISPATCHES_OF_RUN})`,
  'DELETE FROM question_threads WHERE run_id = ?',
  'DELETE FROM decision_gates WHERE run_id = ?',
  'DELETE FROM deliveries WHERE run_id = ?',
  'DELETE FROM messages WHERE run_id = ?',
  'DELETE FROM dispatch_contexts WHERE run_id = ?',
  'DELETE FROM tasks WHERE run_id = ?',
  // The runs trigger forgets the run's coordinator handles.
  'DELETE FROM runs WHERE id = ?'
]

function sqliteTimestamp(ms: number): string {
  // Matches datetime('now'): `YYYY-MM-DD HH:MM:SS` in UTC, so text comparison orders correctly.
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

/** Deletes runs finished before `now - maxAgeMs`, each in its own transaction. */
export function pruneFinishedOrchestrationRuns(
  db: Database.Database,
  options: { now?: number; maxAgeMs?: number } = {}
): { removedRunIds: string[] } {
  const cutoff = sqliteTimestamp(
    (options.now ?? Date.now()) - (options.maxAgeMs ?? FINISHED_RUN_RETENTION_MS)
  )
  const cutoffBindings = ELIGIBLE_RUNS_SQL.split('?').length - 2
  const runIds = db
    .prepare(ELIGIBLE_RUNS_SQL)
    .all(LEGACY_RUN_ID, ...Array.from({ length: cutoffBindings }, () => cutoff))
    .map((row) => String(row.id))
  const statements = DELETE_RUN_SQL.map((sql) => db.prepare(sql))
  const removedRunIds: string[] = []
  for (const runId of runIds) {
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const statement of statements) {
        statement.run(runId)
      }
      db.exec('COMMIT')
      removedRunIds.push(runId)
    } catch (error) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // Why: a failed COMMIT may already have rolled back.
      }
      throw error
    }
  }
  return { removedRunIds }
}

/** Once per database open; a failure is logged and never blocks orchestration. */
export function pruneFinishedOrchestrationRunsSafely(orchestrationDb: {
  db: Database.Database
}): void {
  try {
    const { removedRunIds } = pruneFinishedOrchestrationRuns(orchestrationDb.db)
    if (removedRunIds.length > 0) {
      console.info(
        `[orchestration] removed ${removedRunIds.length} run(s) finished over 30 days ago`
      )
    }
  } catch (error) {
    console.warn('[orchestration] finished-run retention failed', error)
  }
}
