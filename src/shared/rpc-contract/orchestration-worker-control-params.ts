import { z } from 'zod'
import { OptionalFiniteNumber, requiredString } from './rpc-param-primitives'
import { ORCHESTRATION_WORKER_READ_SOURCES } from '../orchestration-worker-output'

export const WorkerDispatchParams = z.object({ dispatch: requiredString('Missing --dispatch') })

// Why `from`: the brief carries the dispatch capability, so only the assignee pane may read it.
export const WorkerBriefParams = WorkerDispatchParams.extend({
  from: requiredString('Missing --from')
})

export const WorkerReadParams = WorkerDispatchParams.extend({
  cursor: z.union([z.number().int().nonnegative(), z.string().min(1).max(2_048)]).optional(),
  limit: OptionalFiniteNumber,
  source: z.enum(ORCHESTRATION_WORKER_READ_SOURCES).optional()
})
