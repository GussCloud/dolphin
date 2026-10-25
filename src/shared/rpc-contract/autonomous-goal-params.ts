import { z } from 'zod'
import { OptionalString, requiredString } from './rpc-param-primitives'
import {
  AUTONOMOUS_GOAL_AGENTS,
  AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT,
  AUTONOMOUS_GOAL_NOTE_KINDS,
  AUTONOMOUS_GOAL_NOTE_MAX_CHARS,
  AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS
} from '../autonomous-goal-types'

const GoalAgent = z.enum(AUTONOMOUS_GOAL_AGENTS)

export const GoalStartParams = z.object({
  from: requiredString('Missing coordinator terminal'),
  objective: requiredString('Missing --objective').pipe(
    z.string().max(AUTONOMOUS_GOAL_OBJECTIVE_MAX_CHARS, 'Objective is too long')
  ),
  agent: GoalAgent,
  workerAgent: GoalAgent,
  maxConcurrent: z.number().int().min(1).max(AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT),
  // Why optional: older clients omit them, and absence keeps the defaults (remove, keep own).
  removeWorktrees: z.boolean().optional(),
  keepCoordinatorWorktree: z.boolean().optional()
})

export const GoalNoteParams = z.object({
  from: requiredString('Missing coordinator terminal'),
  kind: z.enum(AUTONOMOUS_GOAL_NOTE_KINDS),
  text: requiredString('Missing --text').pipe(
    z.string().max(AUTONOMOUS_GOAL_NOTE_MAX_CHARS, 'Note is too long')
  )
})

export const GoalCompleteParams = z.object({
  from: requiredString('Missing coordinator terminal'),
  summary: requiredString('Missing --summary').pipe(
    z.string().max(AUTONOMOUS_GOAL_NOTE_MAX_CHARS, 'Summary is too long')
  )
})

/** By id, or the open goal of the calling coordinator terminal. */
export const GoalShowParams = z.object({ id: OptionalString, from: OptionalString })

export const GoalListParams = z.object({}).optional().default({})

export const GoalStopParams = z.object({ id: requiredString('Missing --id') })
