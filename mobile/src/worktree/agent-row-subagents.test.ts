import { describe, expect, it } from 'vitest'
import { AGENT_STATUS_STALE_AFTER_MS } from './agent-row-display'
import { agentRowSubagentsSignature, readAgentRowSubagents } from './agent-row-subagents'

const NOW = 10_000_000

function row(subagents: unknown, updatedAt = NOW) {
  return { updatedAt, stateStartedAt: 42, subagents }
}

describe('readAgentRowSubagents', () => {
  it('reads teammate name and state from the optional wire field', () => {
    expect(
      readAgentRowSubagents(
        row([
          {
            id: 'a',
            description: 'researcher',
            agentType: 'general',
            state: 'working',
            startedAt: 7
          },
          { id: 'b', agentType: 'tester', state: 'waiting', startedAt: 0 },
          { id: 'c', state: 'blocked', startedAt: 9 }
        ]),
        NOW
      )
    ).toEqual([
      {
        id: 'a',
        name: 'researcher',
        dotState: 'working',
        stateLabel: 'Working',
        startedAt: 7
      },
      {
        id: 'b',
        name: 'tester',
        dotState: 'waiting',
        stateLabel: 'Waiting for input',
        startedAt: 42
      },
      {
        id: 'c',
        name: 'Teammate',
        dotState: 'blocked',
        stateLabel: 'Blocked',
        startedAt: 9
      }
    ])
  })

  it('returns nothing for old hosts and drops malformed entries', () => {
    expect(readAgentRowSubagents({ updatedAt: NOW, stateStartedAt: 1 }, NOW)).toEqual([])
    expect(readAgentRowSubagents(row('nope'), NOW)).toEqual([])
    expect(
      readAgentRowSubagents(row([null, { id: 'x', state: 'exploding' }, { state: 'idle' }]), NOW)
    ).toEqual([])
  })

  it('reads active teammates of a stale leader as unverifiable', () => {
    const [subagent] = readAgentRowSubagents(
      row([{ id: 'a', state: 'working', startedAt: 1 }], NOW - AGENT_STATUS_STALE_AFTER_MS - 1),
      NOW
    )
    expect(subagent).toMatchObject({
      dotState: 'idle',
      stateLabel: 'Unverifiable'
    })
  })
})

describe('agentRowSubagentsSignature', () => {
  it('is empty without teammates', () => {
    expect(
      agentRowSubagentsSignature({
        paneKey: 'p',
        parentPaneKey: null,
        state: 'idle',
        agentType: null,
        prompt: '',
        taskTitle: null,
        displayName: null,
        lastAssistantMessage: null,
        toolName: null,
        toolInput: null,
        interrupted: false,
        stateStartedAt: 0,
        updatedAt: 0
      })
    ).toBe('')
  })
})
