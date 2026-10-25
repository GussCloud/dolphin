// `goal.*` — the coordinator side of an autonomous goal. The coordinator agent calls these from its
// own terminal, so the host that runs it owns the goal, the same way it owns the goal's Run.
import { buildAutonomousCoordinatorInstructions } from '../../../../shared/autonomous-coordinator-prompt'
import { defineMethod, type RpcContext } from '../core'
import { resolveOrchestrationCaller } from './orchestration/runs/run-scope'
import { OrchestrationError } from '../../orchestration/orchestration-error'
import { getAutonomousGoalStore } from '../../../autonomous-goals/autonomous-goal-store-instance'
import type { AutonomousGoal } from '../../../../shared/autonomous-goal-types'
import {
  GoalCompleteParams,
  GoalListParams,
  GoalNoteParams,
  GoalShowParams,
  GoalStartParams,
  GoalStopParams
} from '../../../../shared/rpc-contract/autonomous-goal-params'

function callerPaneKey(
  from: string,
  context: Pick<
    RpcContext,
    'orchestrationCompatibilityEvidence' | 'orchestrationCaller' | 'runtime'
  >
): ReturnType<typeof resolveOrchestrationCaller> & { paneKey: string } {
  const caller = resolveOrchestrationCaller(context.runtime, {
    callerTerminalHandle: from,
    callerEvidence: context.orchestrationCompatibilityEvidence,
    callerSession: context.orchestrationCaller,
    requireStablePane: true
  })
  if (caller.paneKey === null) {
    // Why: rotation clears the conversation in place, which needs a terminal pane, not a structured session.
    throw new OrchestrationError(
      'goal_requires_terminal_pane',
      'An autonomous goal must be coordinated from a Dolphin agent terminal.'
    )
  }
  return { ...caller, paneKey: caller.paneKey }
}

function requireOpenGoal(paneKey: string): AutonomousGoal {
  const goal = getAutonomousGoalStore().findOpenByPane(paneKey)
  if (!goal) {
    throw new OrchestrationError(
      'goal_not_found',
      'No open goal is bound to this terminal. Run `dolphin goal start` first.'
    )
  }
  return goal
}

async function terminalWorktreeId(
  runtime: RpcContext['runtime'],
  handle: string | null
): Promise<string | null> {
  if (!handle) {
    return null
  }
  try {
    return (await runtime.showTerminal(handle)).worktreeId ?? null
  } catch {
    return null
  }
}

/** The base the composer created the coordinator's worktree from, which its workers inherit. */
async function worktreeBaseRef(
  runtime: RpcContext['runtime'],
  worktreeId: string | null
): Promise<string | undefined> {
  if (!worktreeId) {
    return undefined
  }
  try {
    return (await runtime.showManagedWorktree(`id:${worktreeId}`)).baseRef || undefined
  } catch {
    return undefined
  }
}

export const AUTONOMOUS_GOAL_METHODS = [
  defineMethod({
    name: 'goal.start',
    params: GoalStartParams,
    handler: async (params, context) => {
      const caller = callerPaneKey(params.from, context)
      const store = getAutonomousGoalStore()
      // Why: a retried or repeated start must not fork a second Run under the same coordinator.
      const existing = store.findOpenByPane(caller.paneKey)
      if (existing) {
        return {
          goal: existing,
          created: false,
          instructions: buildAutonomousCoordinatorInstructions(existing)
        }
      }
      const db = context.runtime.getOrchestrationDb()
      const run = db.createRun({
        objective: params.objective,
        coordinatorHandle: caller.terminalHandle,
        coordinatorPaneKey: caller.paneKey,
        coordinatorDolphinSessionId: caller.dolphinSessionId
      })
      context.runtime.cancelMessageWaiters(params.from)
      const worktreeId = await terminalWorktreeId(context.runtime, caller.terminalHandle)
      const baseRef = await worktreeBaseRef(context.runtime, worktreeId)
      const goal = store.create({
        objective: params.objective,
        agent: params.agent,
        workerAgent: params.workerAgent,
        maxConcurrent: params.maxConcurrent,
        paneKey: caller.paneKey,
        worktreeId,
        runId: run.id,
        ...(baseRef ? { baseRef } : {}),
        ...(params.removeWorktrees === undefined
          ? {}
          : { removeWorktrees: params.removeWorktrees }),
        ...(params.keepCoordinatorWorktree === undefined
          ? {}
          : { keepCoordinatorWorktree: params.keepCoordinatorWorktree })
      })
      return { goal, created: true, instructions: buildAutonomousCoordinatorInstructions(goal) }
    }
  }),
  defineMethod({
    name: 'goal.note',
    params: GoalNoteParams,
    handler: (params, context) => {
      const goal = requireOpenGoal(callerPaneKey(params.from, context).paneKey)
      const store = getAutonomousGoalStore()
      const noted = store.addNote(goal.id, params.kind, params.text)
      const status =
        params.kind === 'blocker' ? 'blocked' : noted.status === 'blocked' ? 'active' : noted.status
      return { goal: status === noted.status ? noted : store.update(goal.id, { status }) }
    }
  }),
  defineMethod({
    name: 'goal.complete',
    params: GoalCompleteParams,
    handler: (params, context) => {
      const goal = requireOpenGoal(callerPaneKey(params.from, context).paneKey)
      return {
        goal: getAutonomousGoalStore().update(goal.id, {
          status: 'complete',
          summary: params.summary.trim(),
          notes: goal.notes.filter((note) => note.kind !== 'blocker')
        })
      }
    }
  }),
  defineMethod({
    name: 'goal.show',
    params: GoalShowParams,
    handler: (params, context) => {
      if (params.id) {
        const goal = getAutonomousGoalStore().get(params.id)
        if (!goal) {
          throw new OrchestrationError('goal_not_found', `Goal ${params.id} was not found.`)
        }
        return { goal }
      }
      if (!params.from) {
        throw new OrchestrationError('goal_not_found', 'Pass --id or run inside the coordinator.')
      }
      return { goal: requireOpenGoal(callerPaneKey(params.from, context).paneKey) }
    }
  }),
  defineMethod({
    name: 'goal.list',
    params: GoalListParams,
    handler: () => ({ goals: getAutonomousGoalStore().list() })
  }),
  defineMethod({
    name: 'goal.stop',
    params: GoalStopParams,
    handler: (params) => {
      const store = getAutonomousGoalStore()
      if (!store.get(params.id)) {
        throw new OrchestrationError('goal_not_found', `Goal ${params.id} was not found.`)
      }
      return { goal: store.update(params.id, { status: 'stopped' }) }
    }
  })
]
