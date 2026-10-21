import type { AgentInteractionKind } from './agent-interaction-settings'
import type { AgentStatusEntry, AgentSubagentSnapshot } from './agent-status-types'
import { isDoneNoticeDeferredToAutoRetry } from './stop-failure-error-kind'

/** The status-row facts the classifier reads; a store row or a parsed hook payload both fit. */
export type AgentInteractionStatusRow = Pick<
  AgentStatusEntry,
  | 'state'
  | 'stateStartedAt'
  | 'workingMode'
  | 'interactivePrompt'
  | 'interrupted'
  | 'sessionBoundary'
  | 'mainAgent'
  | 'subagents'
  | 'restoredUnconfirmed'
>

export type AgentInteractionTransitionOptions = {
  /** `claudeAutoRetryOnConnectionLoss`; `undefined` means its default (on). */
  autoRetryEnabled?: boolean
}

function isAttentionState(state: AgentSubagentSnapshot['state']): boolean {
  return state === 'blocked' || state === 'waiting'
}

function classifyDone(
  next: AgentInteractionStatusRow,
  options: AgentInteractionTransitionOptions
): AgentInteractionKind | null {
  // Why: a boundary is a session landing idle (connect/resume/clear), not a finished turn.
  if (next.sessionBoundary) {
    return null
  }
  // Why: auto-retry either resumes the turn or raises `retry-exhausted` itself.
  if (isDoneNoticeDeferredToAutoRetry(next.mainAgent, options.autoRetryEnabled)) {
    return null
  }
  if (next.interrupted || next.mainAgent?.outcome === 'cancellation') {
    return 'task-interrupted'
  }
  return next.mainAgent?.outcome === 'failure' ? 'task-failed' : 'task-done'
}

function classifyLeadTransition(
  prev: AgentInteractionStatusRow,
  next: AgentInteractionStatusRow,
  options: AgentInteractionTransitionOptions
): AgentInteractionKind | null {
  const enteredState = prev.state !== next.state || prev.stateStartedAt !== next.stateStartedAt
  if (next.state === 'blocked') {
    return enteredState ? 'needs-permission' : null
  }
  // Why: an AskUserQuestion can surface on a row that never left `working`.
  const promptAppeared = Boolean(next.interactivePrompt) && !prev.interactivePrompt
  if (next.state === 'waiting' ? enteredState || promptAppeared : promptAppeared) {
    return 'needs-input'
  }
  if (!enteredState) {
    return null
  }
  // Why done→done counts: a batched publication can fold a whole working turn into one write.
  if (next.state === 'done') {
    return classifyDone(next, options)
  }
  // Why: a watch loop is not a new task, and resuming from blocked/waiting is the same task.
  return next.state === 'working' && prev.state === 'done' && next.workingMode !== 'monitoring'
    ? 'task-started'
    : null
}

function classifySubagentTransitions(
  prev: AgentInteractionStatusRow,
  next: AgentInteractionStatusRow
): AgentInteractionKind[] {
  const prevById = new Map((prev.subagents ?? []).map((child) => [child.id, child]))
  const nextById = new Map((next.subagents ?? []).map((child) => [child.id, child]))
  let attention = false
  let done = false
  for (const child of nextById.values()) {
    const before = prevById.get(child.id)
    if (isAttentionState(child.state) && (!before || !isAttentionState(before.state))) {
      attention = true
    }
    if (child.state === 'idle' && before?.state === 'working') {
      done = true
    }
  }
  // Why: providers drop finished children from the inventory instead of marking them idle;
  // when the lead itself ended the children went with it, which `task-*` already covers.
  if (next.state !== 'done') {
    for (const before of prevById.values()) {
      if (before.state === 'working' && !nextById.has(before.id)) {
        done = true
      }
    }
  }
  const kinds: AgentInteractionKind[] = []
  if (attention) {
    kinds.push('subagent-attention')
  }
  if (done) {
    kinds.push('subagent-done')
  }
  return kinds
}

/**
 * The interaction events one status write earns. Pure: the caller owns the previous row.
 *
 * A row with no predecessor earns nothing except `task-started`/attention, so a hydrate or a
 * reconnect replay never announces a turn the user did not see begin.
 */
export function classifyAgentInteractionTransition(
  prev: AgentInteractionStatusRow | undefined,
  next: AgentInteractionStatusRow,
  options: AgentInteractionTransitionOptions = {}
): AgentInteractionKind[] {
  // Why: a hydrated row is a replay of the past, never live evidence.
  if (next.restoredUnconfirmed) {
    return []
  }
  if (!prev) {
    if (next.state === 'blocked') {
      return ['needs-permission']
    }
    if (next.state === 'waiting' || next.interactivePrompt) {
      return ['needs-input']
    }
    return next.state === 'working' && next.workingMode !== 'monitoring' ? ['task-started'] : []
  }
  const kinds = classifySubagentTransitions(prev, next)
  const lead = classifyLeadTransition(prev, next, options)
  return lead ? [lead, ...kinds] : kinds
}
