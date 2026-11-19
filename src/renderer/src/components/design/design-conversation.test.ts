import { describe, expect, it } from 'vitest'
import type { DesignDecision, DesignMessage } from '../../../../shared/design-types'
import {
  designBlockActivity,
  designDeliveryState,
  designThread,
  sortDesignDecisions
} from './design-conversation'

function decision(
  id: string,
  askedAt: number,
  extra: Partial<DesignDecision> = {}
): DesignDecision {
  return {
    id,
    question: id,
    options: [{ label: 'a' }, { label: 'b' }],
    multiSelect: false,
    askedAt,
    ...extra
  }
}

function message(id: string, at: number, extra: Partial<DesignMessage> = {}): DesignMessage {
  return { id, author: 'user', text: id, at, ...extra }
}

describe('designBlockActivity', () => {
  it('counts open decisions and messages per block, skipping answered and general ones', () => {
    const activity = designBlockActivity({
      decisions: [
        decision('d1', 1, { blockId: 'b1' }),
        decision('d2', 2, { blockId: 'b1', answer: { selected: ['a'], at: 3 } }),
        decision('d3', 3)
      ],
      messages: [
        message('m1', 1, { blockId: 'b1' }),
        message('m2', 2, { blockId: 'b2' }),
        message('m3', 3)
      ]
    })
    expect(activity.get('b1')).toEqual({ openDecisions: 1, messages: 1 })
    expect(activity.get('b2')).toEqual({ openDecisions: 0, messages: 1 })
    expect(activity.size).toBe(2)
  })
})

describe('designThread', () => {
  const messages = [
    message('reply', 5, { author: 'agent', replyTo: 'ask', blockId: 'b1' }),
    message('ask', 1, { blockId: 'b1' }),
    message('other-block', 2, { blockId: 'b2' }),
    message('note', 3, { author: 'agent', blockId: 'b1' }),
    message('orphan', 4, { author: 'agent', replyTo: 'gone', blockId: 'b1' }),
    message('general', 6)
  ]

  it('nests agent replies under the user message they answer, oldest first', () => {
    const thread = designThread(messages, 'b1')
    expect(thread.map((entry) => entry.message.id)).toEqual(['ask', 'note', 'orphan'])
    expect(thread[0]?.replies.map((reply) => reply.id)).toEqual(['reply'])
  })

  it('keeps the general thread apart from block threads', () => {
    expect(designThread(messages, undefined).map((entry) => entry.message.id)).toEqual(['general'])
  })
})

describe('sortDesignDecisions', () => {
  it('lists open decisions oldest first, then answered ones by latest answer', () => {
    const sorted = sortDesignDecisions([
      decision('answered-old', 1, { answer: { selected: ['a'], at: 10 } }),
      decision('open-new', 5),
      decision('answered-new', 2, { answer: { selected: ['b'], at: 20 } }),
      decision('open-old', 3)
    ])
    expect(sorted.map((entry) => entry.id)).toEqual([
      'open-old',
      'open-new',
      'answered-new',
      'answered-old'
    ])
  })
})

describe('designDeliveryState', () => {
  const item = { id: 'i', kind: 'comment' as const, refId: 'm', createdAt: 1 }

  it('reports blocked delivery over pending items', () => {
    expect(designDeliveryState({ inbox: [item], delivery: { nudges: 3, blockedAt: 9 } })).toEqual({
      kind: 'blocked',
      pending: 1
    })
  })

  it('counts only unacked items as pending', () => {
    expect(
      designDeliveryState({
        inbox: [item, { ...item, id: 'j', ackedAt: 2 }],
        delivery: { nudges: 1 }
      })
    ).toEqual({ kind: 'pending', pending: 1 })
    expect(
      designDeliveryState({ inbox: [{ ...item, ackedAt: 2 }], delivery: { nudges: 0 } })
    ).toEqual({
      kind: 'read'
    })
  })

  it('claims nothing when the user never sent anything', () => {
    expect(designDeliveryState({ inbox: [], delivery: { nudges: 0 } })).toEqual({ kind: 'idle' })
  })
})
