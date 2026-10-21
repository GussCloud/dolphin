import { describe, expect, it } from 'vitest'
import {
  classifyAgentInteractionTransition,
  type AgentInteractionStatusRow
} from './agent-interaction-transition'
import type { AgentSubagentSnapshot } from './agent-status-types'

function row(overrides: Partial<AgentInteractionStatusRow> = {}): AgentInteractionStatusRow {
  return { state: 'working', stateStartedAt: 1, ...overrides }
}

function child(id: string, state: AgentSubagentSnapshot['state']): AgentSubagentSnapshot {
  return { id, state, startedAt: 1 }
}

describe('classifyAgentInteractionTransition', () => {
  it('asks for permission when the lead becomes blocked, once', () => {
    const blocked = row({ state: 'blocked', stateStartedAt: 2 })
    expect(classifyAgentInteractionTransition(row(), blocked)).toEqual(['needs-permission'])
    expect(classifyAgentInteractionTransition(blocked, { ...blocked })).toEqual([])
  })

  it('asks for input on waiting or on a question that appears mid-turn', () => {
    expect(
      classifyAgentInteractionTransition(row(), row({ state: 'waiting', stateStartedAt: 2 }))
    ).toEqual(['needs-input'])
    expect(classifyAgentInteractionTransition(row(), row({ interactivePrompt: '{}' }))).toEqual([
      'needs-input'
    ])
    const asking = row({ interactivePrompt: '{}' })
    expect(classifyAgentInteractionTransition(asking, { ...asking })).toEqual([])
  })

  it('classifies a finished turn by its verdict', () => {
    const done = (extra: Partial<AgentInteractionStatusRow>) =>
      classifyAgentInteractionTransition(row(), row({ state: 'done', stateStartedAt: 2, ...extra }))
    expect(done({})).toEqual(['task-done'])
    expect(done({ interrupted: true })).toEqual(['task-interrupted'])
    expect(
      done({ mainAgent: { state: 'done', outcome: 'cancellation', stateStartedAt: 2 } })
    ).toEqual(['task-interrupted'])
    expect(
      done({
        mainAgent: { state: 'done', outcome: 'failure', failureKind: 'rate_limit', stateStartedAt: 2 }
      })
    ).toEqual(['task-failed'])
  })

  it('stays quiet on a session boundary and on a failure auto-retry still owns', () => {
    const retryable = row({
      state: 'done',
      stateStartedAt: 2,
      mainAgent: { state: 'done', outcome: 'failure', failureKind: 'server_error', stateStartedAt: 2 }
    })
    expect(
      classifyAgentInteractionTransition(row(), row({ state: 'done', sessionBoundary: true }))
    ).toEqual([])
    expect(classifyAgentInteractionTransition(row(), retryable)).toEqual([])
    expect(
      classifyAgentInteractionTransition(row(), retryable, { autoRetryEnabled: false })
    ).toEqual(['task-failed'])
  })

  it('counts a batched turn that lands done→done with a new start', () => {
    const first = row({ state: 'done', stateStartedAt: 2 })
    expect(classifyAgentInteractionTransition(first, { ...first })).toEqual([])
    expect(classifyAgentInteractionTransition(first, { ...first, stateStartedAt: 5 })).toEqual([
      'task-done'
    ])
  })

  it('starts a task only from done, never from a resumed prompt or a watch loop', () => {
    const done = row({ state: 'done' })
    expect(classifyAgentInteractionTransition(done, row({ stateStartedAt: 2 }))).toEqual([
      'task-started'
    ])
    expect(
      classifyAgentInteractionTransition(done, row({ stateStartedAt: 2, workingMode: 'monitoring' }))
    ).toEqual([])
    expect(
      classifyAgentInteractionTransition(row({ state: 'blocked' }), row({ stateStartedAt: 2 }))
    ).toEqual([])
  })

  it('reports subagents that need attention or finish while the lead keeps working', () => {
    const before = row({ subagents: [child('a', 'working'), child('b', 'working')] })
    expect(
      classifyAgentInteractionTransition(
        before,
        row({ subagents: [child('a', 'blocked'), child('b', 'idle')] })
      )
    ).toEqual(['subagent-attention', 'subagent-done'])
    expect(
      classifyAgentInteractionTransition(before, row({ subagents: [child('a', 'working')] }))
    ).toEqual(['subagent-done'])
  })

  it('leaves children that ended with the lead to the task event', () => {
    const before = row({ subagents: [child('a', 'working')] })
    expect(
      classifyAgentInteractionTransition(before, row({ state: 'done', stateStartedAt: 2 }))
    ).toEqual(['task-done'])
  })

  it('never announces a hydrated row, and a first sighting only for live attention or a start', () => {
    expect(
      classifyAgentInteractionTransition(undefined, row({ state: 'blocked', restoredUnconfirmed: true }))
    ).toEqual([])
    expect(classifyAgentInteractionTransition(undefined, row({ state: 'done' }))).toEqual([])
    expect(classifyAgentInteractionTransition(undefined, row({ state: 'blocked' }))).toEqual([
      'needs-permission'
    ])
    expect(classifyAgentInteractionTransition(undefined, row())).toEqual(['task-started'])
  })
})
