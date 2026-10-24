import { defineMethod } from '../../../core'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { getWorkerBriefStore } from '../../../../orchestration/worker-brief-store'
import { resolveOrchestrationCaller } from '../runs/run-scope'
import { WorkerBriefParams } from '../../../../../../shared/rpc-contract/orchestration-worker-control-params'

export const ORCHESTRATION_WORKER_BRIEF_METHODS = [
  defineMethod({
    name: 'orchestration.workerBrief',
    params: WorkerBriefParams,
    handler: (params, context) => {
      const caller = resolveOrchestrationCaller(context.runtime, {
        callerTerminalHandle: params.from,
        callerEvidence: context.orchestrationCompatibilityEvidence,
        callerSession: context.orchestrationCaller,
        requireStablePane: true
      })
      const held = getWorkerBriefStore(context.runtime).read(params.dispatch)
      // Why one error for both: a foreign pane must not learn which dispatch ids exist.
      if (!held || caller.paneKey !== held.paneKey) {
        throw new OrchestrationError(
          'worker_brief_not_found',
          `No brief for Dispatch ${params.dispatch} is held for this terminal. Ask your coordinator to redispatch the task.`
        )
      }
      return { dispatchId: params.dispatch, taskId: held.taskId, brief: held.brief }
    }
  })
]
