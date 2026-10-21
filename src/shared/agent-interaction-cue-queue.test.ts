import { describe, expect, it } from 'vitest'
import {
  AgentInteractionCueQueue,
  pickAgentInteractionKind,
  type AgentInteractionCue
} from './agent-interaction-cue-queue'

function cue(paneKey: string, overrides: Partial<AgentInteractionCue> = {}): AgentInteractionCue {
  return { kind: 'task-done', paneKey, worktreeId: 'w1', createdAt: 1, ...overrides }
}

describe('pickAgentInteractionKind', () => {
  it('announces the most urgent event of one write', () => {
    expect(pickAgentInteractionKind(['subagent-done', 'task-done'])).toBe('task-done')
    expect(pickAgentInteractionKind(['subagent-attention', 'needs-permission'])).toBe(
      'needs-permission'
    )
    expect(pickAgentInteractionKind([])).toBeNull()
  })
})

describe('AgentInteractionCueQueue', () => {
  it('shows the newest cue and counts the rest, one per pane', () => {
    const queue = new AgentInteractionCueQueue()
    queue.push(cue('a'))
    queue.push(cue('b', { kind: 'needs-input' }))
    queue.push(cue('a', { kind: 'needs-permission' }))
    expect(queue.current()).toEqual({
      cue: cue('a', { kind: 'needs-permission' }),
      pendingCount: 1
    })
  })

  it('drops a request once the agent stops waiting for it', () => {
    const queue = new AgentInteractionCueQueue()
    queue.push(cue('a', { kind: 'needs-permission' }))
    expect(queue.reconcile('a', 'blocked')).toBe(false)
    expect(queue.reconcile('a', 'working')).toBe(true)
    expect(queue.current()).toBeNull()
  })

  it('keeps a finished-task cue until a new turn starts', () => {
    const queue = new AgentInteractionCueQueue()
    queue.push(cue('a'))
    expect(queue.reconcile('a', 'done')).toBe(false)
    expect(queue.reconcile('a', 'working')).toBe(true)
  })

  it('acknowledges by pane or by whole workspace', () => {
    const queue = new AgentInteractionCueQueue()
    queue.push(cue('a'))
    queue.push(cue('b'))
    queue.push(cue('c', { worktreeId: 'w2' }))
    expect(queue.acknowledge({ paneKeys: ['c'] })).toBe(true)
    expect(queue.acknowledge({ worktreeId: 'w1' })).toBe(true)
    expect(queue.current()).toBeNull()
    expect(queue.acknowledge({ worktreeId: 'w1' })).toBe(false)
  })
})
