import { defineMethod } from '../../../core'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { getWorkerBriefStore } from '../../../../orchestration/worker-brief-store'
import { resolveOrchestrationCaller } from '../runs/run-scope'
import { WorkerBriefParams } from '../../../../../../shared/rpc-contract/orchestration-worker-control-params'

// Why: a worker launched with the pointer can ask while its start is still minting the brief.
const WORKER_BRIEF_HOLD_WAIT_MS = 30_000

export const ORCHESTRATION_WORKER_BRIEF_METHODS = [
  defineMethod({
    name: 'orchestration.workerBrief',
    params: WorkerBriefParams,
    handler: async (params, context) => {
      const caller = resolveOrchestrationCaller(context.runtime, {
        callerTerminalHandle: params.from,
        callerEvidence: context.orchestrationCompatibilityEvidence,
        callerSession: context.orchestrationCaller,
        requireStablePane: true
      })
      const store = getWorkerBriefStore(context.runtime)
      // Only a worker still starting can be ahead of its brief; anything else answers at once.
      const starting =
        context.runtime.getOrchestrationDb().getWorkerDispatch(params.dispatch)?.state ===
        'starting'
      const held = await store.waitForHold(
        params.dispatch,
        starting ? WORKER_BRIEF_HOLD_WAIT_MS : 0
      )
      // Why one error for both: a foreign pane must not learn which dispatch ids exist.
      if (!held || caller.paneKey !== held.paneKey) {
        throw new OrchestrationError(
          'worker_brief_not_found',
          `No brief for Dispatch ${params.dispatch} is held for this terminal. Ask your coordinator to redispatch the task.`
        )
      }
      store.markFetched(params.dispatch)
      return { dispatchId: params.dispatch, taskId: held.taskId, brief: held.brief }
    }
  })
]
