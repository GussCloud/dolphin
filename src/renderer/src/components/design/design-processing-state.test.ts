import { describe, expect, it } from 'vitest'
import type {
  Design,
  DesignAgentStatus,
  DesignInboxItem,
  DesignMessage
} from '../../../../shared/design-types'
import {
  designItemsAwaitingAgent,
  designItemsBeingProcessed,
  designProcessingBlocksApproval,
  designProcessingState,
  designProcessingTargets,
  designSidePanelNotices,
  type DesignProcessingState
} from './design-processing-state'

type Input = Pick<
  Design,
  'inbox' | 'delivery' | 'messages' | 'canvasVersions' | 'decisions' | 'completion'
>

function input(extra: Partial<Input> = {}): Input {
  return {
    inbox: [],
    delivery: { nudges: 0 },
    messages: [],
    canvasVersions: [{ version: 1, at: 10, canvas: { groups: [], edges: [] } }],
    decisions: [],
    ...extra
  }
}

function item(
  id: string,
  createdAt: number,
  extra: Partial<DesignInboxItem> = {}
): DesignInboxItem {
  return { id, kind: 'comment', refId: `m-${id}`, createdAt, ...extra }
}

function agentMessage(at: number, extra: Partial<DesignMessage> = {}): DesignMessage {
  return { id: `a${at}`, author: 'agent', text: 'ok', at, ...extra }
}

const idle: DesignAgentStatus = { live: true, status: 'idle' }
const working: DesignAgentStatus = { live: true, status: 'working' }

describe('designProcessingState', () => {
  it('is idle when nothing was ever sent', () => {
    expect(designProcessingState(input(), idle)).toBe('idle')
    expect(designProcessingState(input(), null)).toBe('idle')
    expect(designProcessingState(input(), { live: false, status: null })).toBe('idle')
  })

  it('is queued while input waits and no notice was typed', () => {
    expect(designProcessingState(input({ inbox: [item('i1', 20)] }), idle)).toBe('queued')
  })

  it('is blocked, and does not lock approval, once delivery stopped after unread notices', () => {
    const design = input({
      inbox: [item('i1', 20)],
      delivery: { nudges: 3, lastNudgeAt: 30, blockedAt: 90 }
    })
    expect(designProcessingState(design, idle)).toBe('blocked')
    expect(designProcessingBlocksApproval('blocked')).toBe(false)
    // A busy agent is still processing even when notices went unread.
    expect(designProcessingState(design, working)).toBe('processing')
  })

  it('is notified once a notice was typed and not acked', () => {
    const design = input({ inbox: [item('i1', 20)], delivery: { nudges: 1, lastNudgeAt: 21 } })
    expect(designProcessingState(design, idle)).toBe('notified')
  })

  it('is processing while the agent works, whatever the inbox says', () => {
    expect(designProcessingState(input(), working)).toBe('processing')
    expect(
      designProcessingState(input({ inbox: [item('i1', 20, { ackedAt: 21 })] }), working)
    ).toBe('processing')
  })

  it('needs permission when the agent is blocked on a terminal prompt', () => {
    const design = input({ inbox: [item('i1', 20, { ackedAt: 21 })] })
    expect(designProcessingState(design, { live: true, status: 'permission' })).toBe(
      'needs-permission'
    )
  })

  it('is replied when the agent produced output after the latest input and is idle', () => {
    const viaMessage = input({
      inbox: [item('i1', 20, { ackedAt: 21 })],
      messages: [agentMessage(25)]
    })
    expect(designProcessingState(viaMessage, idle)).toBe('replied')
    const viaCanvas = input({
      inbox: [item('i1', 20, { ackedAt: 21 })],
      canvasVersions: [{ version: 2, at: 30, canvas: { groups: [], edges: [] } }]
    })
    expect(designProcessingState(viaCanvas, idle)).toBe('replied')
  })

  it('is idle when the agent read everything but produced nothing newer', () => {
    expect(designProcessingState(input({ inbox: [item('i1', 20, { ackedAt: 21 })] }), idle)).toBe(
      'idle'
    )
  })

  it('is unknown, not idle, when the status cannot be read while input waits', () => {
    expect(designProcessingState(input({ inbox: [item('i1', 20)] }), null)).toBe('unknown')
    expect(
      designProcessingState(input({ inbox: [item('i1', 20)] }), { live: true, status: null })
    ).toBe('unknown')
  })

  it('is offline when no live terminal holds the agent while input waits', () => {
    expect(
      designProcessingState(input({ inbox: [item('i1', 20)] }), { live: false, status: null })
    ).toBe('offline')
  })
})

describe('designItemsAwaitingAgent', () => {
  it('keeps unread items and read items with nothing produced since', () => {
    const design = input({
      inbox: [item('old', 5, { ackedAt: 6 }), item('read', 20, { ackedAt: 21 }), item('new', 30)]
    })
    expect(designItemsAwaitingAgent(design).map((entry) => entry.id)).toEqual(['read', 'new'])
  })

  it('drops a read comment the agent replied to directly', () => {
    const design = input({
      inbox: [item('c1', 20, { ackedAt: 21 }), item('c2', 22, { ackedAt: 23 })],
      messages: [agentMessage(5, { replyTo: 'm-c1' })]
    })
    expect(designItemsAwaitingAgent(design).map((entry) => entry.id)).toEqual(['c2'])
  })
})

describe('designItemsBeingProcessed', () => {
  it('lists read, unanswered items only while processing', () => {
    const design = input({ inbox: [item('read', 20, { ackedAt: 21 }), item('unread', 22)] })
    expect(designItemsBeingProcessed(design, 'processing').map((entry) => entry.id)).toEqual([
      'read'
    ])
    expect(designItemsBeingProcessed(design, 'notified')).toEqual([])
  })

  it('lists a notified item the agent works on before acking it, not one sent after the notice', () => {
    // The real agent acks only after it acted: the item stays unacked the whole time it works.
    const design = input({
      inbox: [item('told', 20), item('later', 40)],
      delivery: { nudges: 1, lastNudgeAt: 25 }
    })
    expect(designItemsBeingProcessed(design, 'processing').map((entry) => entry.id)).toEqual([
      'told'
    ])
  })
})

describe('designProcessingBlocksApproval', () => {
  it('blocks while the agent holds input, not when its status is unverifiable or absent', () => {
    const all: DesignProcessingState[] = [
      'idle',
      'queued',
      'notified',
      'processing',
      'needs-permission',
      'replied',
      'unknown',
      'offline'
    ]
    expect(all.filter(designProcessingBlocksApproval)).toEqual([
      'queued',
      'notified',
      'processing',
      'needs-permission'
    ])
  })
})

describe('designProcessingTargets', () => {
  it('maps processed items to their block thread, the general thread and the decision', () => {
    const design = input({
      inbox: [
        item('c1', 20, { ackedAt: 21, refId: 'm1' }),
        item('c2', 22, { ackedAt: 23, refId: 'm2' }),
        item('a1', 24, { ackedAt: 25, kind: 'answer', refId: 'd1' }),
        item('s1', 26, { ackedAt: 27, kind: 'status', refId: 'in-progress' })
      ],
      messages: [
        { id: 'm1', author: 'user', text: 'x', at: 20, blockId: 'b1' },
        { id: 'm2', author: 'user', text: 'y', at: 22 }
      ]
    })
    const targets = designProcessingTargets(design, 'processing')
    expect([...targets.blockIds]).toEqual(['b1'])
    expect(targets.general).toBe(true)
    expect([...targets.decisionIds]).toEqual(['d1'])
    expect(designProcessingTargets(design, 'replied')).toEqual({
      blockIds: new Set(),
      general: false,
      decisionIds: new Set()
    })
  })
})

describe('designSidePanelNotices', () => {
  it('keeps the actionable delivery prompts and adds only live work or absence to them', () => {
    const blocked = { kind: 'blocked', pending: 1 } as const
    expect(designSidePanelNotices(blocked, 'notified')).toEqual({
      delivery: true,
      processing: false
    })
    expect(designSidePanelNotices(blocked, 'processing')).toEqual({
      delivery: true,
      processing: true
    })
    const notifyNow = { kind: 'pending', pending: 1, offerNotifyNow: true } as const
    expect(designSidePanelNotices(notifyNow, 'unknown')).toEqual({
      delivery: true,
      processing: false
    })
    expect(designSidePanelNotices(notifyNow, 'offline')).toEqual({
      delivery: true,
      processing: true
    })
  })

  it('lets the indicator replace the plain waiting and read lines', () => {
    const pending = { kind: 'pending', pending: 1, offerNotifyNow: false } as const
    expect(designSidePanelNotices(pending, 'queued')).toEqual({ delivery: false, processing: true })
    expect(designSidePanelNotices({ kind: 'read' }, 'replied')).toEqual({
      delivery: false,
      processing: true
    })
    expect(designSidePanelNotices({ kind: 'read' }, 'idle')).toEqual({
      delivery: true,
      processing: false
    })
  })
})
