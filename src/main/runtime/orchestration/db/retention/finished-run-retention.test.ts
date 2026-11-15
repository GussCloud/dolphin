import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import { pruneFinishedOrchestrationRuns } from './finished-run-retention'

const NOW = Date.UTC(2026, 10, 15)
const OLD = '2026-09-01 10:00:00'
const RECENT = '2026-11-10 10:00:00'

let orchestration: OrchestrationDb

function seedRun(
  runId: string,
  options: {
    at?: string
    taskStatus?: string
    dispatchState?: string
    releaseState?: string
    federated?: boolean
  } = {}
): void {
  const at = options.at ?? OLD
  const db = orchestration.db
  db.prepare('INSERT INTO runs (id, objective, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    runId,
    'objective',
    at,
    at
  )
  db.prepare(
    'INSERT INTO tasks (id, run_id, spec, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(`${runId}-task`, runId, 'spec', options.taskStatus ?? 'completed', at, at)
  const dispatchId = `${runId}-dispatch`
  db.prepare(
    'INSERT INTO dispatch_contexts (id, run_id, task_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(dispatchId, runId, `${runId}-task`, at)
  db.prepare(
    'INSERT INTO worker_dispatches (dispatch_id, state, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(dispatchId, options.dispatchState ?? 'succeeded', at, at)
  db.prepare(
    `INSERT INTO worker_terminal_resources
       (id, origin_dispatch_id, owner_dispatch_id, terminal_handle, release_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(`${runId}-res`, dispatchId, dispatchId, 'term', options.releaseState ?? 'released', at, at)
  db.prepare(
    "INSERT INTO worker_terminal_archives (dispatch_id, resource_id, kind, content, created_at) VALUES (?, ?, 'terminal_tail', ?, ?)"
  ).run(dispatchId, `${runId}-res`, 'x'.repeat(1000), at)
  db.prepare(
    "INSERT INTO messages (id, run_id, from_handle, to_handle, subject, created_at) VALUES (?, ?, 'a', 'b', 's', ?)"
  ).run(`${runId}-msg`, runId, at)
  if (options.federated) {
    db.prepare(
      'INSERT INTO federated_dispatches (dispatch_id, environment_id, environment_name, peer_fingerprint) VALUES (?, ?, ?, ?)'
    ).run(dispatchId, 'env', 'Server', 'fp')
  }
}

function count(table: string, runId: string): number {
  const column = table === 'runs' ? 'id' : 'run_id'
  return Number(
    orchestration.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`).get(runId)?.n
  )
}

beforeEach(() => {
  orchestration = new OrchestrationDb(':memory:')
})

afterEach(() => {
  orchestration.close()
})

describe('pruneFinishedOrchestrationRuns', () => {
  it('removes a run finished over 30 days ago with every row it owns', () => {
    seedRun('old')

    expect(pruneFinishedOrchestrationRuns(orchestration.db, { now: NOW })).toEqual({
      removedRunIds: ['old']
    })
    for (const table of ['runs', 'tasks', 'dispatch_contexts', 'messages']) {
      expect(count(table, 'old')).toBe(0)
    }
    const leftover = orchestration.db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM worker_dispatches) +
           (SELECT COUNT(*) FROM worker_terminal_resources) +
           (SELECT COUNT(*) FROM worker_terminal_archives) AS n`
      )
      .get()
    expect(Number(leftover?.n)).toBe(0)
  })

  it('keeps recent, unfinished, live, retained and federated runs', () => {
    seedRun('recent', { at: RECENT })
    seedRun('pending-task', { taskStatus: 'dispatched' })
    seedRun('live-worker', { dispatchState: 'ready' })
    seedRun('retained-terminal', { releaseState: 'retained' })
    seedRun('federated', { federated: true })

    expect(pruneFinishedOrchestrationRuns(orchestration.db, { now: NOW })).toEqual({
      removedRunIds: []
    })
    for (const runId of [
      'recent',
      'pending-task',
      'live-worker',
      'retained-terminal',
      'federated'
    ]) {
      expect(count('runs', runId)).toBe(1)
    }
  })

  it('never touches the legacy run', () => {
    orchestration.db.prepare('UPDATE runs SET updated_at = ?').run(OLD)
    pruneFinishedOrchestrationRuns(orchestration.db, { now: NOW })
    expect(
      Number(orchestration.db.prepare('SELECT COUNT(*) AS n FROM runs WHERE legacy = 1').get()?.n)
    ).toBe(1)
  })
})
