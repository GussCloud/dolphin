import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { OrchestrationDb } from '../runtime/orchestration/db'
import { createRootDispatch } from '../runtime/orchestration/db/root-dispatch-test-fixture'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import { ORCHESTRATION_METHODS } from '../runtime/rpc/methods/orchestration'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import { createAutonomousGoalWorkerStallPorts } from './autonomous-goal-worker-stall-ports'

const WORKER_HANDLE = 'term_worker'
const WORKER_PANE = 'tab_worker:33333333-3333-4333-8333-333333333333'

// Why the real DB and method table: the ports must read the rows and speak the verb contracts
// the watchdog depends on, so a renamed column or param fails here instead of hiding a stall.
describe('autonomous goal worker stall ports', () => {
  let db: OrchestrationDb
  let runtime: DolphinRuntimeService
  let ports: ReturnType<typeof createAutonomousGoalWorkerStallPorts>
  let runId: string
  let taskId: string
  let dispatchId: string

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    runtime = new DolphinRuntimeService()
    runtime.setOrchestrationDb(db)
    const dispatcher = new RpcDispatcher({ runtime, methods: [...ORCHESTRATION_METHODS] })
    ports = createAutonomousGoalWorkerStallPorts({
      dispatch: (request) => dispatcher.dispatch(request),
      runtime,
      readPaneStatus: () => undefined
    })
    runId = db.createRun({
      objective: 'Ship',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:leaf_coord'
    }).id
    const task = db.createTask({ runId, spec: 'stalls' })
    taskId = task.id
    dispatchId = createRootDispatch(db, task.id, WORKER_HANDLE, WORKER_PANE).id
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('lists the dispatched worker of each Task with its pane', () => {
    expect(ports.listActiveWorkers(runId)).toEqual([
      {
        dispatchId,
        taskId,
        taskOrdinal: 1,
        taskStatus: 'dispatched',
        paneKey: WORKER_PANE,
        awaitingReply: false
      }
    ])
  })

  it('takes the newest report from the worker and ignores its heartbeats', () => {
    const question = db.insertMessage({
      runId,
      from: WORKER_HANDLE,
      to: `run:${runId}`,
      subject: 'which API?',
      type: 'question'
    })
    db.insertMessage({
      runId,
      from: WORKER_HANDLE,
      to: `run:${runId}`,
      subject: 'still working',
      type: 'heartbeat'
    })
    expect(ports.latestWorkerReportId(runId, dispatchId)).toBe(question.id)
  })

  it('escalates into the Run mailbox and wakes its reader', () => {
    const notify = vi.spyOn(runtime, 'notifyMessageArrived')
    const goal: AutonomousGoal = {
      id: 'goal_1',
      objective: 'Ship',
      agent: 'claude',
      workerAgent: 'claude',
      maxConcurrent: 1,
      status: 'active',
      paneKey: 'coordinator',
      worktreeId: null,
      runId,
      notes: [],
      rotations: 0,
      createdAt: 1,
      updatedAt: 1
    }
    const [worker] = ports.listActiveWorkers(runId)
    ports.escalate(goal, worker!, 'no progress for 120 min')

    const [message] = db.getAllMessagesForHandle(`run:${runId}`, 5)
    expect(message).toMatchObject({
      type: 'escalation',
      priority: 'high',
      subject: 'Worker stalled: Task 1 (no progress for 120 min)'
    })
    expect(message?.body).toContain(`--task ${taskId} --retry-of ${dispatchId}`)
    expect(notify).toHaveBeenCalledWith(`run:${runId}`, 'escalation')
  })

  it('stops through orchestration.workerStop with its real params', async () => {
    // A param the verb's schema rejected would fail as invalid_argument before the lookup.
    await expect(ports.stopWorker('dispatch_missing')).rejects.toThrow(/dispatch_missing/)
  })
})
