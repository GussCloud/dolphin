import { describe, expect, it } from 'vitest'
import {
  DESIGN_INBOX_UNNOTIFIED_HINT_MS,
  type DesignDecision,
  type DesignMessage
} from '../../../../shared/design-types'
import {
  designBlockActivity,
  designDeliveryState,
  designThread,
  shouldOfferDesignNotifyNow,
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
    expect(
      designDeliveryState({ inbox: [item], delivery: { nudges: 3, blockedAt: 9 } }, 2)
    ).toEqual({
      kind: 'blocked',
      pending: 1
    })
  })

  it('counts only unacked items as pending', () => {
    expect(
      designDeliveryState(
        {
          inbox: [item, { ...item, id: 'j', ackedAt: 2 }],
          delivery: { nudges: 1 }
        },
        2
      )
    ).toEqual({ kind: 'pending', pending: 1, offerNotifyNow: false })
    expect(
      designDeliveryState({ inbox: [{ ...item, ackedAt: 2 }], delivery: { nudges: 0 } }, 2)
    ).toEqual({
      kind: 'read'
    })
  })

  it('claims nothing when the user never sent anything', () => {
    expect(designDeliveryState({ inbox: [], delivery: { nudges: 0 } }, 2)).toEqual({ kind: 'idle' })
  })
})

describe('shouldOfferDesignNotifyNow', () => {
  const item = { id: 'i', kind: 'comment' as const, refId: 'm', createdAt: 1_000 }
  const late = 1_000 + DESIGN_INBOX_UNNOTIFIED_HINT_MS + 1

  it('offers a notice for input pending past the delay that no nudge reached', () => {
    expect(shouldOfferDesignNotifyNow({ inbox: [item], delivery: { nudges: 0 } }, late)).toBe(true)
    expect(designDeliveryState({ inbox: [item], delivery: { nudges: 0 } }, late)).toEqual({
      kind: 'pending',
      pending: 1,
      offerNotifyNow: true
    })
  })

  it('measures from the oldest pending item, ignoring acked ones', () => {
    const fresh = { ...item, id: 'j', createdAt: late - 10 }
    const acked = { ...item, id: 'k', createdAt: 0, ackedAt: 5 }
    expect(
      shouldOfferDesignNotifyNow({ inbox: [acked, fresh], delivery: { nudges: 0 } }, late)
    ).toBe(false)
    expect(
      shouldOfferDesignNotifyNow({ inbox: [fresh, item], delivery: { nudges: 0 } }, late)
    ).toBe(true)
  })

  it('stays quiet before the delay, after a nudge, while blocked, or once requested', () => {
    expect(
      shouldOfferDesignNotifyNow(
        { inbox: [item], delivery: { nudges: 0 } },
        1_000 + DESIGN_INBOX_UNNOTIFIED_HINT_MS
      )
    ).toBe(false)
    expect(shouldOfferDesignNotifyNow({ inbox: [item], delivery: { nudges: 1 } }, late)).toBe(false)
    expect(
      shouldOfferDesignNotifyNow({ inbox: [item], delivery: { nudges: 0, blockedAt: 2 } }, late)
    ).toBe(false)
    expect(
      shouldOfferDesignNotifyNow(
        { inbox: [item], delivery: { nudges: 0, forceRequestedAt: 2 } },
        late
      )
    ).toBe(false)
    expect(shouldOfferDesignNotifyNow({ inbox: [], delivery: { nudges: 0 } }, late)).toBe(false)
  })
})
