import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DESIGN_DECISION_MAX_OPEN,
  DESIGN_MAX_MESSAGES,
  pendingDesignInbox,
  type DesignCanvas
} from '../../shared/design-types'
import { DesignStore, toDesignListEntry } from './design-store'
import { DESIGN_MAX_ACKED_INBOX_ITEMS } from './design-interaction'
import { expandDesignInbox } from './design-inbox'

const CANVAS: DesignCanvas = {
  groups: [{ id: 'g1', title: 'Start', blocks: [{ id: 'b1', kind: 'trigger', title: 'Click' }] }],
  edges: []
}
const OPTIONS = [{ label: 'Card' }, { label: 'Pix' }]

describe('DesignStore conversation', () => {
  let dir: string
  let file: string
  let clock: number

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-conv-'))
    file = join(dir, 'designs.json')
    clock = 1_000
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const store = (): DesignStore =>
    new DesignStore(
      () => file,
      () => clock++
    )

  function designWithCanvas(designs: DesignStore): string {
    const { id } = designs.create({
      name: 'Checkout',
      request: 'Pay',
      agent: 'claude',
      repoId: null
    })
    designs.setCanvas(id, CANVAS)
    return id
  }

  it('reloads a phase-1 record with empty conversation fields', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    const [stored] = JSON.parse(readFileSync(file, 'utf-8'))
    delete stored.decisions
    delete stored.messages
    delete stored.inbox
    delete stored.delivery
    writeFileSync(file, JSON.stringify([stored]))
    const reloaded = store().get(id)!
    expect(reloaded).toMatchObject({
      decisions: [],
      messages: [],
      inbox: [],
      delivery: { nudges: 0 }
    })
    expect(toDesignListEntry(reloaded)).toMatchObject({
      openDecisionCount: 0,
      deliveryBlocked: false
    })
  })

  it('drops invalid conversation entries on reload and keeps the rest', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    designs.addDecisions(id, [{ question: 'Pay how?', options: OPTIONS }])
    designs.addComment(id, { blockId: 'b1', text: 'Rename this' })
    const [stored] = JSON.parse(readFileSync(file, 'utf-8'))
    stored.decisions.push({ id: 'd-bad', question: 'x', options: [] })
    stored.messages.push({ id: 'm-bad', author: 'bot', text: 'x', at: 1 })
    stored.inbox.push({ id: 'i-bad', kind: 'answer', refId: 'nowhere', createdAt: 1 })
    stored.delivery = { nudges: -1 }
    writeFileSync(file, JSON.stringify([stored]))
    const reloaded = store().get(id)!
    expect(reloaded.decisions).toHaveLength(1)
    expect(reloaded.messages.map((m) => m.author)).toEqual(['user'])
    expect(reloaded.inbox.map((item) => item.kind)).toEqual(['comment'])
    expect(reloaded.delivery).toEqual({ nudges: 0 })
  })

  it('asks decisions, caps the open ones and logs the ask', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    const [asked] = designs.addDecisions(id, [
      { question: 'Pay how?', options: OPTIONS, blockId: 'b1' }
    ])
    expect(asked).toMatchObject({
      multiSelect: false,
      blockId: 'b1',
      id: expect.stringMatching(/^d-/)
    })
    expect(designs.get(id)!.events.at(-1)).toMatchObject({ kind: 'decision-asked', actor: 'agent' })
    const more = Array.from({ length: DESIGN_DECISION_MAX_OPEN }, () => ({
      question: 'Q',
      options: OPTIONS
    }))
    expect(() => designs.addDecisions(id, more)).toThrow(/at most 10/)
    expect(() =>
      designs.addDecisions(id, [{ question: 'Q', options: OPTIONS, blockId: 'zz' }])
    ).toThrow(/Block "zz" is not on the latest canvas/)
    expect(toDesignListEntry(designs.get(id)!).openDecisionCount).toBe(1)
  })

  it('answers a decision once, with valid options, and queues it for the agent', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    const [decision] = designs.addDecisions(id, [{ question: 'Pay how?', options: OPTIONS }])
    const answer = (selected: string[]) =>
      designs.answerDecision(id, { decisionId: decision!.id, selected, note: 'cheaper' })
    expect(() => answer(['Bitcoin'])).toThrow(/Not an option.*Bitcoin/)
    expect(() => answer(['Card', 'Pix'])).toThrow(/exactly one option/)
    expect(() => designs.answerDecision(id, { decisionId: 'd-none', selected: ['Card'] })).toThrow(
      /not on design/
    )
    expect(answer(['Card']).answer).toMatchObject({ selected: ['Card'], note: 'cheaper' })
    expect(() => answer(['Pix'])).toThrow(/already answered/)
    const design = designs.get(id)!
    expect(design.events.at(-1)).toMatchObject({ kind: 'decision-answered', actor: 'user' })
    expect(expandDesignInbox(design)).toEqual([
      expect.objectContaining({
        kind: 'answer',
        decisionId: decision!.id,
        question: 'Pay how?',
        selected: ['Card'],
        note: 'cheaper'
      })
    ])
    expect(toDesignListEntry(design).openDecisionCount).toBe(0)
  })

  it('accepts several options on a multi-select decision', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    const [decision] = designs.addDecisions(id, [
      { question: 'Which?', options: OPTIONS, multiSelect: true }
    ])
    expect(
      designs.answerDecision(id, { decisionId: decision!.id, selected: ['Card', 'Pix', 'Card'] })
        .answer?.selected
    ).toEqual(['Card', 'Pix'])
  })

  it('threads comments and replies by block and refuses bad references', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    expect(() => designs.addComment(id, { blockId: 'zz', text: 'Hi' })).toThrow(/Block "zz"/)
    const comment = designs.addComment(id, { blockId: 'b1', text: 'Why a click?' })
    expect(designs.get(id)!.events.at(-1)).toMatchObject({ kind: 'comment-added', detail: 'b1' })
    expect(expandDesignInbox(designs.get(id)!)).toEqual([
      expect.objectContaining({
        kind: 'comment',
        messageId: comment.id,
        block: { id: 'b1', title: 'Click' }
      })
    ])
    expect(() => designs.addReply(id, { replyTo: 'm-none', text: 'x' })).toThrow(
      /not a user message/
    )
    expect(() =>
      designs.addReply(id, { replyTo: comment.id, blockId: 'other', text: 'x' })
    ).toThrow(/drop blockId or match it/)
    const reply = designs.addReply(id, { replyTo: comment.id, text: 'It is the entry point.' })
    expect(reply).toMatchObject({ author: 'agent', blockId: 'b1', replyTo: comment.id })
    expect(() => designs.addReply(id, { replyTo: reply.id, text: 'x' })).toThrow(
      /not a user message/
    )
    expect(designs.get(id)!.events.at(-1)).toMatchObject({ kind: 'agent-replied', actor: 'agent' })
  })

  it('acks items, resets delivery, and refuses unknown ids', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    designs.addComment(id, { text: 'General note' })
    designs.recordNudge(id)
    designs.recordNudge(id)
    designs.markDeliveryBlocked(id)
    expect(toDesignListEntry(designs.get(id)!).deliveryBlocked).toBe(true)
    const [item] = pendingDesignInbox(designs.get(id)!)
    expect(() => designs.ack(id, [item!.id, 'i-none'])).toThrow(/Not in the inbox.*i-none/)
    expect(designs.ack(id, [item!.id])).toBe(1)
    expect(designs.ack(id, [item!.id])).toBe(0)
    const design = designs.get(id)!
    expect(design.delivery).toEqual({ nudges: 0 })
    expect(pendingDesignInbox(design)).toEqual([])
    expect(design.events.map((e) => [e.kind, e.actor]).slice(-5)).toEqual([
      ['inbox-nudged', 'dolphin'],
      ['inbox-nudged', 'dolphin'],
      ['delivery-blocked', 'dolphin'],
      ['inbox-acked', 'agent'],
      ['inbox-acked', 'agent']
    ])
  })

  it('resend clears a blocked delivery and logs it as the user', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    designs.recordNudge(id)
    designs.markDeliveryBlocked(id)
    designs.resend(id)
    const design = store().get(id)!
    expect(design.delivery).toEqual({ nudges: 0 })
    expect(design.events.at(-1)).toMatchObject({ kind: 'delivery-resent', actor: 'user' })
  })

  it('resend records a one-shot force request only while items are pending, kept across a reload', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    designs.resend(id)
    expect(designs.get(id)!.delivery).toEqual({ nudges: 0 })
    designs.addComment(id, { text: 'x' })
    designs.resend(id)
    const forced = store().get(id)!.delivery
    expect(forced.forceRequestedAt).toEqual(expect.any(Number))
    designs.recordNudge(id)
    expect(store().get(id)!.delivery.forceRequestedAt).toBeUndefined()
    designs.resend(id)
    designs.ack(
      id,
      pendingDesignInbox(designs.get(id)!).map((item) => item.id)
    )
    expect(store().get(id)!.delivery).toEqual({ nudges: 0 })
  })

  it('bounds messages and acked inbox history but keeps pending items', () => {
    const designs = store()
    const id = designWithCanvas(designs)
    for (let index = 0; index < DESIGN_MAX_ACKED_INBOX_ITEMS + 5; index += 1) {
      designs.addComment(id, { text: `c${index}` })
    }
    const pending = pendingDesignInbox(designs.get(id)!)
    designs.ack(
      id,
      pending.slice(0, -1).map((item) => item.id)
    )
    designs.addComment(id, { text: 'last' })
    const design = designs.get(id)!
    expect(design.inbox.filter((item) => item.ackedAt !== undefined)).toHaveLength(
      DESIGN_MAX_ACKED_INBOX_ITEMS
    )
    expect(pendingDesignInbox(design)).toHaveLength(2)
    for (let index = 0; index < DESIGN_MAX_MESSAGES; index += 1) {
      designs.addReply(id, { text: `r${index}` })
    }
    const capped = designs.get(id)!
    expect(capped.messages).toHaveLength(DESIGN_MAX_MESSAGES)
    // Why: the pending comments aged out of the thread, so their inbox items have nothing to point at.
    expect(pendingDesignInbox(capped)).toEqual([])
  })
})
