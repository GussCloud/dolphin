import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eraseRpcMethods, type RpcContext } from '../core'
import { DolphinRuntimeService } from '../../dolphin-runtime'
import { DesignStore } from '../../../designs/design-store'
import { DESIGN_METHODS } from './designs'

const PANE_A = 'tab_a:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PANE_B = 'tab_b:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let store: DesignStore

vi.mock('../../../designs/design-store-instance', () => ({
  getDesignStore: () => store
}))

const CANVAS = {
  groups: [
    { id: 'g1', title: 'Start', blocks: [{ id: 'b1', kind: 'trigger', title: 'Click' }] },
    { id: 'g2', title: 'End', blocks: [] }
  ],
  edges: [{ id: 'e1', fromGroupId: 'g1', fromBlockId: 'b1', toGroupId: 'g2' }]
}

describe('design.* RPC methods', () => {
  let dir: string
  let ctx: RpcContext

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-rpc-'))
    store = new DesignStore(() => join(dir, 'designs.json'))
    const runtime = new DolphinRuntimeService()
    vi.spyOn(runtime, 'getTerminalPaneKey').mockImplementation((handle) =>
      handle === 'term_a' ? PANE_A : handle === 'term_b' ? PANE_B : null
    )
    vi.spyOn(runtime, 'showTerminal').mockRejectedValue(new Error('not in this test'))
    ctx = { runtime }
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function method(name: string) {
    const found = eraseRpcMethods(DESIGN_METHODS).find((m) => m.name === name)
    if (!found?.params) {
      throw new Error(`missing ${name}`)
    }
    return found
  }

  async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const found = method(name)
    return found.handler(found.params!.parse(params), ctx)
  }

  async function createDesign(): Promise<string> {
    const result = await call('design.create', {
      name: 'Checkout',
      request: 'Pay by card',
      agent: 'claude'
    })
    expect(result).toMatchObject({
      design: { status: 'draft' },
      launchPrompt: expect.stringContaining('dolphin design start --id')
    })
    return store.list()[0]!.id
  }

  it('binds the caller pane on start, keeps the draft status and returns the rules', async () => {
    const id = await createDesign()
    const result = await call('design.start', { from: 'term_a', id })
    expect(result).toMatchObject({
      design: { paneKey: PANE_A, status: 'draft' },
      instructions: expect.stringContaining('Pay by card')
    })
    expect(result).toHaveProperty('instructions', expect.stringContaining('Do not change any file'))
    expect(store.get(id)?.events.map((event) => event.kind)).toEqual(['created', 'agent-bound'])
  })

  it('binds a done design without reopening it', async () => {
    const id = await createDesign()
    store.setStatus(id, 'in-progress')
    store.setStatus(id, 'done')
    expect(await call('design.start', { from: 'term_a', id })).toMatchObject({
      design: { paneKey: PANE_A, status: 'done' },
      instructions: expect.stringContaining('confirmed the design is done')
    })
  })

  it('refuses a canvas from an unbound pane or another pane', async () => {
    const id = await createDesign()
    await expect(call('design.canvasSet', { from: 'term_a', id, canvas: CANVAS })).rejects.toThrow(
      /dolphin design start --id/
    )
    await call('design.start', { from: 'term_a', id })
    await expect(call('design.canvasSet', { from: 'term_b', id, canvas: CANVAS })).rejects.toThrow(
      /not bound/
    )
    expect(await call('design.canvasSet', { from: 'term_a', id, canvas: CANVAS })).toEqual({
      version: 1
    })
  })

  it('lets a restarted agent rebind from a new pane', async () => {
    const id = await createDesign()
    await call('design.start', { from: 'term_a', id })
    await call('design.start', { from: 'term_b', id })
    expect(await call('design.canvasSet', { from: 'term_b', id, canvas: CANVAS })).toEqual({
      version: 1
    })
    expect(store.get(id)?.events.filter((event) => event.kind === 'agent-bound')).toHaveLength(2)
  })

  it('refuses an edge to an unknown group with a message naming the edge', async () => {
    const id = await createDesign()
    await call('design.start', { from: 'term_a', id })
    const canvas = { ...CANVAS, edges: [{ id: 'e9', fromGroupId: 'g1', toGroupId: 'nope' }] }
    await expect(call('design.canvasSet', { from: 'term_a', id, canvas })).rejects.toThrow(
      'Canvas refused: Edge "e9" points to an unknown group'
    )
  })

  it('names the field path of every bad element, up to five', async () => {
    const id = await createDesign()
    await call('design.start', { from: 'term_a', id })
    const block = { id: 'b1', kind: 'banana', title: 'Click' }
    const canvas = { groups: [{ id: 'g1', title: 'Start', blocks: [block] }], edges: [] }
    await expect(call('design.canvasSet', { from: 'term_a', id, canvas })).rejects.toThrow(
      /groups\.0\.blocks\.0\.kind: /
    )
    const many = {
      groups: Array.from({ length: 7 }, (_, index) => ({ id: `g${index}`, title: '', blocks: [] })),
      edges: []
    }
    await expect(call('design.canvasSet', { from: 'term_a', id, canvas: many })).rejects.toThrow(
      /groups\.4\.title: .*\(\+2 more\)$/
    )
    expect(store.get(id)?.canvasVersions).toEqual([])
  })

  it('refuses an invalid status move and lists the allowed ones', async () => {
    const id = await createDesign()
    await expect(call('design.setStatus', { id, status: 'done' })).rejects.toThrow(
      'cannot move from draft to done; allowed: in-progress, discarded'
    )
    await expect(
      call('design.setStatus', { id, status: 'discarded', from: 'term_a' })
    ).rejects.toThrow(/Only the user moves design .*dolphin design complete/)
    expect(await call('design.setStatus', { id, status: 'discarded' })).toMatchObject({
      design: { status: 'discarded' }
    })
    await expect(call('design.start', { from: 'term_a', id })).rejects.toThrow(/discarded/)
  })

  it('lists designs newest first without canvas history', async () => {
    const first = await createDesign()
    await call('design.create', { name: 'Second', request: 'More', agent: 'codex' })
    await call('design.rename', { id: first, name: 'Renamed' })
    const listed = await call('design.list', {})
    expect(listed).toMatchObject({ designs: [{ name: 'Renamed' }, { name: 'Second' }] })
    expect(listed).toHaveProperty('designs.length', 2)
    expect(listed).not.toHaveProperty('designs.0.canvasVersions')
  })

  describe('design.agentStatus', () => {
    it('is not live before an agent binds', async () => {
      const id = await createDesign()
      const live = vi.spyOn(ctx.runtime, 'getLiveTerminalHandleForPaneKey')
      expect(await call('design.agentStatus', { id })).toEqual({ live: false, status: null })
      expect(live).not.toHaveBeenCalled()
    })

    it('is not live when the bound pane has no connected terminal', async () => {
      const id = await createDesign()
      await call('design.start', { from: 'term_a', id })
      vi.spyOn(ctx.runtime, 'getLiveTerminalHandleForPaneKey').mockReturnValue(null)
      expect(await call('design.agentStatus', { id })).toEqual({ live: false, status: null })
    })

    it('reads the status of the live handle for the bound pane', async () => {
      const id = await createDesign()
      await call('design.start', { from: 'term_a', id })
      const live = vi
        .spyOn(ctx.runtime, 'getLiveTerminalHandleForPaneKey')
        .mockReturnValue('term_live')
      const status = vi
        .spyOn(ctx.runtime, 'getTerminalAgentStatus')
        .mockResolvedValue({ handle: 'term_live', isRunningAgent: true, status: 'working' })
      expect(await call('design.agentStatus', { id })).toEqual({ live: true, status: 'working' })
      expect(live).toHaveBeenCalledWith(PANE_A)
      expect(status).toHaveBeenCalledWith('term_live')
    })

    it('reports an unreadable status as unverifiable, not as an exited pane', async () => {
      const id = await createDesign()
      await call('design.start', { from: 'term_a', id })
      vi.spyOn(ctx.runtime, 'getLiveTerminalHandleForPaneKey').mockReturnValue('term_live')
      vi.spyOn(ctx.runtime, 'getTerminalAgentStatus').mockRejectedValue(new Error('terminal_gone'))
      expect(await call('design.agentStatus', { id })).toEqual({ live: true, status: null })
    })

    it('refuses an unknown design', async () => {
      await expect(call('design.agentStatus', { id: 'nope' })).rejects.toThrow(/not found/)
    })
  })
})
