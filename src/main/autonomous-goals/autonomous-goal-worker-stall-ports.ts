// The host side of the stall watchdog: Run DB rows, the hook server's status rows, and the
// same `orchestration.workerStop` verb a user would call.
import { randomUUID } from 'node:crypto'
import type { RpcRequest, RpcResponse } from '../runtime/rpc/core'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-ipc-payload'
import { ORCHESTRATION_CONTRACT_VERSION } from '../../shared/protocol-version'
import type { AutonomousGoalWorkerStallPorts } from './autonomous-goal-worker-stall-watchdog'

const RECENT_RUN_MESSAGES = 50

type StallRuntime = Pick<DolphinRuntimeService, 'getOrchestrationDb' | 'notifyMessageArrived'>

export function createAutonomousGoalWorkerStallPorts(args: {
  dispatch: (request: RpcRequest) => Promise<RpcResponse>
  runtime: StallRuntime
  readPaneStatus: (paneKey: string) => AgentStatusIpcPayload | undefined
}): Pick<
  AutonomousGoalWorkerStallPorts,
  'listActiveWorkers' | 'latestWorkerReportId' | 'readWorkerAgent' | 'stopWorker' | 'escalate'
> {
  const db = (): ReturnType<StallRuntime['getOrchestrationDb']> => args.runtime.getOrchestrationDb()
  return {
    listActiveWorkers: (runId) => {
      const tasks = db().listTasks({ runId })
      const active = tasks.flatMap((task, index) => {
        const dispatch = task.status === 'dispatched' ? db().getDispatchContext(task.id) : undefined
        return dispatch?.status === 'dispatched' ? [{ task, ordinal: index + 1, dispatch }] : []
      })
      const attention = db().getWorkerAttentionFactsForDispatches(
        active.map(({ dispatch }) => dispatch.id),
        Date.now()
      )
      return active.map(({ task, ordinal, dispatch }) => {
        const facts = attention.get(dispatch.id)
        return {
          dispatchId: dispatch.id,
          taskId: task.id,
          taskOrdinal: ordinal,
          taskStatus: task.status,
          paneKey: dispatch.assignee_pane_key,
          awaitingReply: Boolean(
            facts?.pendingInput || facts?.pendingApproval || facts?.pendingGuidance
          )
        }
      })
    },
    latestWorkerReportId: (runId, dispatchId) => {
      const handle = db().getDispatchContextById(dispatchId)?.assignee_handle
      if (!handle) {
        return null
      }
      return (
        db()
          .getAllMessagesForHandle(`run:${runId}`, RECENT_RUN_MESSAGES)
          .find((message) => message.from_handle === handle && message.type !== 'heartbeat')?.id ??
        null
      )
    },
    readWorkerAgent: (paneKey) => {
      const row = args.readPaneStatus(paneKey)
      return row
        ? {
            state: row.state,
            stateStartedAt: row.stateStartedAt,
            observedAt: row.evidenceObservedAt ?? row.receivedAt
          }
        : null
    },
    stopWorker: async (dispatchId) => {
      const response = await args.dispatch({
        id: `autonomous-goal-stall-${randomUUID()}`,
        authToken: 'autonomous-goal-stall',
        method: 'orchestration.workerStop',
        params: { dispatch: dispatchId },
        orchestrationContractVersion: ORCHESTRATION_CONTRACT_VERSION
      })
      if (!response.ok) {
        throw new Error(response.error.message)
      }
    },
    escalate: (goal, worker, reason) => {
      const dispatch = db().getDispatchContextById(worker.dispatchId)
      const message = db().insertMessage({
        from: dispatch?.assignee_handle ?? `dispatch:${worker.dispatchId}`,
        to: `run:${goal.runId}`,
        subject: `Worker stalled: Task ${worker.taskOrdinal} (${reason})`,
        body: `Dolphin stopped the worker of Task ${worker.taskOrdinal} (${worker.taskId}): ${reason}. Start it again once with \`dolphin orchestration worker-start --task ${worker.taskId} --retry-of ${worker.dispatchId}\` and the same --worktree, --name and --agent. A second stall blocks the goal.`,
        type: 'escalation',
        priority: 'high',
        payload: JSON.stringify({
          kind: 'worker_stalled',
          taskId: worker.taskId,
          dispatchId: worker.dispatchId,
          reason
        }),
        runId: goal.runId
      })
      args.runtime.notifyMessageArrived(message.to_handle, message.type)
    }
  }
}
