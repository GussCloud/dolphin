import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eraseRpcMethods, type RpcContext } from '../core'
import { DolphinRuntimeService } from '../../dolphin-runtime'
import { DesignStore } from '../../../designs/design-store'
import { pendingDesignInbox } from '../../../../shared/design-types'
import { DESIGN_CONVERSATION_METHODS } from './designs-conversation'

const PANE_A = 'tab_a:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PANE_B = 'tab_b:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let store: DesignStore

vi.mock('../../../designs/design-store-instance', () => ({
  getDesignStore: () => store
}))

const CANVAS = {
  groups: [
    { id: 'g1', title: 'Start', blocks: [{ id: 'b1', kind: 'trigger' as const, title: 'Click' }] }
  ],
  edges: []
}
const DECISION = { question: 'Pay how?', options: [{ label: 'Card' }, { label: 'Pix' }] }

describe('design conversation RPC methods', () => {
  let dir: string
  let ctx: RpcContext
  let id: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-conv-rpc-'))
    store = new DesignStore(() => join(dir, 'designs.json'))
    const runtime = new DolphinRuntimeService()
    vi.spyOn(runtime, 'getTerminalPaneKey').mockImplementation((handle) =>
      handle === 'term_a' ? PANE_A : handle === 'term_b' ? PANE_B : null
    )
    ctx = { runtime }
    id = store.create({ name: 'Checkout', request: 'Pay', agent: 'claude', repoId: null }).id
    store.bindAgent(id, { paneKey: PANE_A, worktreeId: null })
    store.setCanvas(id, CANVAS)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const found = eraseRpcMethods(DESIGN_CONVERSATION_METHODS).find((m) => m.name === name)
    if (!found?.params) {
      throw new Error(`missing ${name}`)
    }
    return found.handler(found.params.parse(params), ctx)
  }

  it('asks decisions only from the bound pane and names bad field paths', async () => {
    await expect(
      call('design.decide', { from: 'term_b', id, decisions: { decisions: [DECISION] } })
    ).rejects.toThrow(/not bound/)
    await expect(
      call('design.decide', {
        from: 'term_a',
        id,
        decisions: { decisions: [{ question: 'Q', options: [{ label: 'only' }] }] }
      })
    ).rejects.toThrow(/Decisions refused: decisions\.0\.options: /)
    await expect(
      call('design.decide', {
        from: 'term_a',
        id,
        decisions: { decisions: [{ ...DECISION, blockId: 'nope' }] }
      })
    ).rejects.toMatchObject({ code: 'design_unknown_block' })
    const result = await call('design.decide', {
      from: 'term_a',
      id,
      decisions: { decisions: [{ ...DECISION, blockId: 'b1' }] }
    })
    expect(result).toMatchObject({ decisions: [{ question: 'Pay how?', blockId: 'b1' }] })
  })

  it('carries an answer and a comment to the agent inbox with an ack hint', async () => {
    await call('design.decide', {
      from: 'term_a',
      id,
      decisions: { decisions: [{ ...DECISION, blockId: 'b1' }] }
    })
    const decisionId = store.get(id)!.decisions[0]!.id
    await expect(
      call('design.answer', { id, decisionId, selected: ['Card', 'Pix'] })
    ).rejects.toMatchObject({ code: 'design_invalid_answer' })
    await call('design.answer', { id, decisionId, selected: ['Pix'], note: 'cheaper' })
    await expect(
      call('design.answer', { id, decisionId, selected: ['Card'] })
    ).rejects.toMatchObject({ code: 'design_decision_answered' })
    await call('design.comment', { id, blockId: 'b1', text: 'Why a click?' })
    await expect(call('design.inbox', { from: 'term_b', id })).rejects.toThrow(/not bound/)
    const inbox = await call('design.inbox', { from: 'term_a', id })
    const ids = pendingDesignInbox(store.get(id)!)
      .map((item) => item.id)
      .join(',')
    expect(inbox).toHaveProperty('items', [
      expect.objectContaining({
        kind: 'answer',
        question: 'Pay how?',
        selected: ['Pix'],
        note: 'cheaper',
        block: { id: 'b1', title: 'Click' }
      }),
      expect.objectContaining({
        kind: 'comment',
        text: 'Why a click?',
        block: { id: 'b1', title: 'Click' }
      })
    ])
    expect(inbox).toHaveProperty(
      'ackCommand',
      `dolphin design ack --id ${id} --items ${ids} --json`
    )
    expect(await call('design.ack', { from: 'term_a', id, items: ids.split(',') })).toEqual({
      acked: 2
    })
    expect(await call('design.inbox', { from: 'term_a', id })).toMatchObject({
      items: [],
      ackCommand: null
    })
  })

  it('posts an agent reply into the comment thread and refuses a bad file', async () => {
    const message = store.addComment(id, { blockId: 'b1', text: 'Hm?' })
    await expect(
      call('design.reply', { from: 'term_a', id, reply: { replyTo: message.id } })
    ).rejects.toThrow(/Reply refused: text: /)
    await expect(
      call('design.reply', { from: 'term_b', id, reply: { replyTo: message.id, text: 'x' } })
    ).rejects.toThrow(/not bound/)
    expect(
      await call('design.reply', {
        from: 'term_a',
        id,
        reply: { replyTo: message.id, text: 'Because.' }
      })
    ).toMatchObject({ message: { author: 'agent', blockId: 'b1', replyTo: message.id } })
  })

  it('revises an answered decision from the bound pane and names bad field paths', async () => {
    const [decision] = store.addDecisions(id, [DECISION])
    const revision = { decisionId: decision!.id, text: 'Card and Pix' }
    await expect(call('design.reviseDecision', { from: 'term_b', id, revision })).rejects.toThrow(
      /not bound/
    )
    await expect(
      call('design.reviseDecision', { from: 'term_a', id, revision: { decisionId: 'x' } })
    ).rejects.toThrow(/Revision refused: text: /)
    await expect(
      call('design.reviseDecision', { from: 'term_a', id, revision })
    ).rejects.toMatchObject({ code: 'design_decision_not_answered' })
    store.answerDecision(id, { decisionId: decision!.id, selected: ['Card'] })
    expect(await call('design.reviseDecision', { from: 'term_a', id, revision })).toMatchObject({
      decision: { id: decision!.id, revision: { text: 'Card and Pix' } }
    })
    expect(store.get(id)!.events.at(-1)).toMatchObject({ kind: 'decision-revised' })
  })

  it('refuses a comment on a block that is not on the canvas', async () => {
    await expect(
      call('design.comment', { id, blockId: 'ghost', text: 'Hi' })
    ).rejects.toMatchObject({ code: 'design_unknown_block' })
  })

  it('resend clears a blocked delivery, and needs a bound agent', async () => {
    store.recordNudge(id)
    store.markDeliveryBlocked(id)
    expect(await call('design.resend', { id })).toMatchObject({
      design: { delivery: { nudges: 0 } }
    })
    expect(store.get(id)!.delivery.blockedAt).toBeUndefined()
    const unbound = store.create({ name: 'U', request: 'R', agent: 'claude', repoId: null })
    await expect(call('design.resend', { id: unbound.id })).rejects.toMatchObject({
      code: 'design_agent_not_bound'
    })
  })

  it('resend works on a delivery that is not blocked and asks for a forced nudge', async () => {
    store.addComment(id, { text: 'Hi' })
    const result = await call('design.resend', { id })
    expect(result).toMatchObject({
      design: { delivery: { nudges: 0, forceRequestedAt: expect.any(Number) } }
    })
  })
})
