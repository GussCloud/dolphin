import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eraseRpcMethods, type RpcContext } from '../core'
import { DolphinRuntimeService } from '../../dolphin-runtime'
import { DesignStore } from '../../../designs/design-store'
import { DESIGN_COMPLETION_SUMMARY_MAX_CHARS } from '../../../../shared/design-types'
import { DESIGN_COMPLETION_METHODS } from './designs-completion'
import { DESIGN_METHODS } from './designs'

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

describe('design completion RPC methods', () => {
  let dir: string
  let ctx: RpcContext
  let id: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-done-rpc-'))
    store = new DesignStore(() => join(dir, 'designs.json'))
    const runtime = new DolphinRuntimeService()
    vi.spyOn(runtime, 'getTerminalPaneKey').mockImplementation((handle) =>
      handle === 'term_a' ? PANE_A : handle === 'term_b' ? PANE_B : null
    )
    vi.spyOn(runtime, 'showTerminal').mockRejectedValue(new Error('not in this test'))
    ctx = { runtime }
    id = store.create({ name: 'Checkout', request: 'Pay', agent: 'claude', repoId: null }).id
    store.bindAgent(id, { paneKey: PANE_A, worktreeId: null })
    store.setCanvas(id, CANVAS)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const found = eraseRpcMethods([...DESIGN_COMPLETION_METHODS, ...DESIGN_METHODS]).find(
      (m) => m.name === name
    )
    if (!found?.params) {
      throw new Error(`missing ${name}`)
    }
    return found.handler(found.params.parse(params), ctx)
  }

  it('accepts a completion only from the bound pane, while in progress, naming bad fields', async () => {
    const completion = { summary: 'Built the checkout' }
    await expect(call('design.complete', { from: 'term_a', id, completion })).rejects.toMatchObject(
      { code: 'design_not_in_progress' }
    )
    await call('design.setStatus', { id, status: 'in-progress' })
    await expect(call('design.complete', { from: 'term_b', id, completion })).rejects.toThrow(
      /not bound/
    )
    await expect(
      call('design.complete', {
        from: 'term_a',
        id,
        completion: { summary: 'x'.repeat(DESIGN_COMPLETION_SUMMARY_MAX_CHARS + 1) }
      })
    ).rejects.toThrow(/^Completion refused: summary: /)
    expect(await call('design.complete', { from: 'term_a', id, completion })).toMatchObject({
      design: { status: 'in-progress', completion: { summary: 'Built the checkout' } }
    })
  })

  it('lets only the user finish: confirm moves to done, decline sends what is left', async () => {
    await call('design.setStatus', { id, status: 'in-progress' })
    await expect(call('design.confirmDone', { id })).rejects.toMatchObject({
      code: 'design_no_completion'
    })
    await call('design.complete', { from: 'term_a', id, completion: { summary: 'Done' } })
    expect(await call('design.declineDone', { id, text: 'Add tests' })).toMatchObject({
      design: { status: 'in-progress', messages: [{ text: 'Add tests' }] }
    })
    await call('design.complete', { from: 'term_a', id, completion: { summary: 'Done, tested' } })
    expect(await call('design.confirmDone', { id })).toMatchObject({ design: { status: 'done' } })
    expect(store.get(id)?.completion).toBeUndefined()
  })

  it('returns the implementation notice to an agent restarted while in progress', async () => {
    await call('design.setStatus', { id, status: 'in-progress' })
    const started = await call('design.start', { from: 'term_b', id })
    expect(started).toHaveProperty(
      'instructions',
      expect.stringContaining('Implement it now in this worktree')
    )
    expect(started).not.toHaveProperty(
      'instructions',
      expect.stringContaining('Do not change any file')
    )
  })
})
