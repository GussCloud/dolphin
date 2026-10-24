import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../flags'
import { RuntimeClientError } from '../runtime-client'
import { resolveCoordinatorTerminalHandle } from './orchestration/terminal-identity'
import { decodeAutonomousGoalObjective } from '../../shared/autonomous-coordinator-prompt'
import {
  AUTONOMOUS_GOAL_AGENTS,
  clampAutonomousGoalMaxConcurrent,
  isAutonomousGoalAgent,
  type AutonomousGoal,
  type AutonomousGoalAgent
} from '../../shared/autonomous-goal-types'

type GoalResult = { goal: AutonomousGoal }

function requireGoalAgent(flags: Map<string, string | boolean>, name: string): AutonomousGoalAgent {
  const value = getRequiredStringFlag(flags, name)
  if (!isAutonomousGoalAgent(value)) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--${name} must be one of ${AUTONOMOUS_GOAL_AGENTS.join(', ')}`
    )
  }
  return value
}

function readObjective(flags: Map<string, string | boolean>): string {
  const encoded = getOptionalStringFlag(flags, 'objective-b64')
  if (encoded) {
    try {
      return decodeAutonomousGoalObjective(encoded)
    } catch {
      throw new RuntimeClientError('invalid_argument', '--objective-b64 is not valid base64 UTF-8')
    }
  }
  return getRequiredStringFlag(flags, 'objective')
}

function formatGoal(goal: AutonomousGoal): string {
  const lines = [
    `${goal.id} [${goal.status}] run ${goal.runId}`,
    goal.objective,
    `coordinator ${goal.agent}, workers ${goal.workerAgent} (max ${goal.maxConcurrent}), rotations ${goal.rotations}`
  ]
  for (const note of goal.notes) {
    lines.push(`${note.kind}: ${note.text}`)
  }
  if (goal.summary) {
    lines.push(`summary: ${goal.summary}`)
  }
  return lines.join('\n')
}

export const GOAL_HANDLERS: Record<string, CommandHandler> = {
  'goal start': async ({ flags, client, cwd, json }) => {
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<GoalResult & { created: boolean }>('goal.start', {
      from,
      objective: readObjective(flags),
      agent: requireGoalAgent(flags, 'agent'),
      workerAgent: requireGoalAgent(flags, 'worker-agent'),
      maxConcurrent: clampAutonomousGoalMaxConcurrent(
        getOptionalPositiveIntegerFlag(flags, 'max-concurrent')
      )
    })
    printResult(result, json, (r) =>
      r.created
        ? `Goal started.\n${formatGoal(r.goal)}`
        : `Goal already open.\n${formatGoal(r.goal)}`
    )
  },

  'goal note': async ({ flags, client, cwd, json }) => {
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<GoalResult>('goal.note', {
      from,
      kind: getRequiredStringFlag(flags, 'kind'),
      text: getRequiredStringFlag(flags, 'text')
    })
    printResult(result, json, (r) => `Noted on ${r.goal.id}.`)
  },

  'goal complete': async ({ flags, client, cwd, json }) => {
    const from = await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<GoalResult>('goal.complete', {
      from,
      summary: getRequiredStringFlag(flags, 'summary')
    })
    printResult(result, json, (r) => `Goal ${r.goal.id} complete.`)
  },

  'goal show': async ({ flags, client, cwd, json }) => {
    const id = getOptionalStringFlag(flags, 'id')
    const from = id ? undefined : await resolveCoordinatorTerminalHandle(flags, cwd, client)
    const result = await client.call<GoalResult>('goal.show', { id, from })
    printResult(result, json, (r) => formatGoal(r.goal))
  },

  'goal list': async ({ client, json }) => {
    const result = await client.call<{ goals: AutonomousGoal[] }>('goal.list', {})
    printResult(result, json, (r) =>
      r.goals.length === 0
        ? 'No goals.'
        : r.goals
            .map((goal) => `${goal.id} [${goal.status}] ${goal.objective.split('\n')[0]}`)
            .join('\n')
    )
  },

  'goal stop': async ({ flags, client, json }) => {
    const result = await client.call<GoalResult>('goal.stop', {
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(result, json, (r) => `Goal ${r.goal.id} stopped.`)
  }
}
