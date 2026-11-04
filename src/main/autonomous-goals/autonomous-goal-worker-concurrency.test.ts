import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { AutonomousGoalStore } from './autonomous-goal-store'
import {
  assertAutonomousGoalWorkerSlot,
  countRunningWorkers
} from './autonomous-goal-worker-concurrency'

describe('autonomous goal worker concurrency', () => {
  let dir: string
  let store: AutonomousGoalStore
  let db: OrchestrationDb
  let runId: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'goal-concurrency-'))
    store = new AutonomousGoalStore(() => join(dir, 'goals.json'))
    db = new OrchestrationDb(':memory:')
    runId = db.createRun({
      objective: 'goal',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    }).id
  })
  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  function startWorker(): string {
    const task = db.createTask({ runId, spec: 'work' })
    return db.createStartingWorkerDispatch({
      taskId: task.id,
      startOptions: {},
      creator: { kind: 'system' },
      maxDepth: 9
    }).dispatch.id
  }

  function createGoal(maxConcurrent: number): void {
    store.create({
      objective: 'ship it',
      agent: 'claude',
      workerAgent: 'claude',
      maxConcurrent,
      paneKey: 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      worktreeId: 'wt',
      runId
    })
  }

  it('refuses a worker past the goal maxConcurrent with an actionable error', () => {
    createGoal(2)
    startWorker()
    assertAutonomousGoalWorkerSlot(() => store, db.db, runId)
    startWorker()
    expect(() => assertAutonomousGoalWorkerSlot(() => store, db.db, runId)).toThrowError(
      expect.objectContaining({
        code: 'goal_worker_limit',
        data: { effectsApplied: false, running: 2, maxConcurrent: 2 }
      })
    )
  })

  it('frees the slot once a worker settles', () => {
    createGoal(1)
    const dispatchId = startWorker()
    expect(() => assertAutonomousGoalWorkerSlot(() => store, db.db, runId)).toThrow()
    db.db
      .prepare("UPDATE worker_dispatches SET state = 'failed' WHERE dispatch_id = ?")
      .run(dispatchId)
    expect(countRunningWorkers(db.db, runId)).toBe(0)
    expect(() => assertAutonomousGoalWorkerSlot(() => store, db.db, runId)).not.toThrow()
  })

  it('leaves Runs without a goal unlimited', () => {
    startWorker()
    startWorker()
    expect(() => assertAutonomousGoalWorkerSlot(() => store, db.db, runId)).not.toThrow()
  })

  it('never reads the goal file before the first worker', () => {
    expect(() =>
      assertAutonomousGoalWorkerSlot(
        () => {
          throw new Error('store opened')
        },
        db.db,
        runId
      )
    ).not.toThrow()
  })
})
