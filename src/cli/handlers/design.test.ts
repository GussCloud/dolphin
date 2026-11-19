import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HandlerContext } from '../dispatch'
import type { RuntimeClient } from '../runtime-client'
import { DESIGN_HANDLERS, readDesignCanvasFile } from './design'

vi.mock('./orchestration/terminal-identity', () => ({
  resolveCoordinatorTerminalHandle: vi.fn().mockResolvedValue('term_agent')
}))

describe('design canvas-set', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-cli-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function context(file: string, call: ReturnType<typeof vi.fn>): HandlerContext {
    return {
      flags: new Map<string, string | boolean>([
        ['id', 'd1'],
        ['file', file]
      ]),
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only calls `call`.
      client: { call } as unknown as RuntimeClient,
      cwd: dir,
      json: true
    }
  }

  it('reads the canvas JSON from a file relative to cwd and sends it', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    writeFileSync(join(dir, 'canvas.json'), JSON.stringify({ groups: [], edges: [] }))
    const call = vi.fn().mockResolvedValue({ id: '1', ok: true, result: { version: 2 } })
    await DESIGN_HANDLERS['design canvas-set']!(context('canvas.json', call))
    expect(call).toHaveBeenCalledWith('design.canvasSet', {
      from: 'term_agent',
      id: 'd1',
      canvas: { groups: [], edges: [] }
    })
  })

  it('names the file when its JSON does not parse, without calling the host', async () => {
    writeFileSync(join(dir, 'bad.json'), '{"groups": [')
    const call = vi.fn()
    await expect(DESIGN_HANDLERS['design canvas-set']!(context('bad.json', call))).rejects.toThrow(
      /--file .*bad\.json is not valid JSON/
    )
    await expect(
      DESIGN_HANDLERS['design canvas-set']!(context('missing.json', call))
    ).rejects.toThrow(/Cannot read --file/)
    expect(call).not.toHaveBeenCalled()
  })

  it('reads the canvas from stdin for --file -', async () => {
    await expect(readDesignCanvasFile('-', dir, async () => '{"groups":[]}')).resolves.toEqual({
      groups: []
    })
    await expect(readDesignCanvasFile('-', dir, async () => '{oops')).rejects.toThrow(
      /--file stdin is not valid JSON/
    )
  })
})

describe('design conversation commands', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-cli-conv-'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function context(
    flags: [string, string][],
    call: ReturnType<typeof vi.fn>,
    json = true
  ): HandlerContext {
    return {
      flags: new Map<string, string | boolean>([['id', 'd1'], ...flags]),
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only calls `call`.
      client: { call } as unknown as RuntimeClient,
      cwd: dir,
      json
    }
  }

  it('sends the decisions file as-is from the agent terminal', async () => {
    const file = { decisions: [{ question: 'Q', options: [{ label: 'A' }, { label: 'B' }] }] }
    writeFileSync(join(dir, 'ask.json'), JSON.stringify(file))
    const call = vi.fn().mockResolvedValue({ id: '1', ok: true, result: { decisions: [] } })
    await DESIGN_HANDLERS['design decide']!(context([['file', 'ask.json']], call))
    expect(call).toHaveBeenCalledWith('design.decide', {
      from: 'term_agent',
      id: 'd1',
      decisions: file
    })
  })

  it('sends the reply file and splits ack items', async () => {
    writeFileSync(join(dir, 'reply.json'), '{"replyTo":"m-1","text":"Done"}')
    const call = vi
      .fn()
      .mockResolvedValue({ id: '1', ok: true, result: { message: { id: 'm-2' }, acked: 2 } })
    await DESIGN_HANDLERS['design reply']!(context([['file', 'reply.json']], call))
    expect(call).toHaveBeenLastCalledWith('design.reply', {
      from: 'term_agent',
      id: 'd1',
      reply: { replyTo: 'm-1', text: 'Done' }
    })
    await DESIGN_HANDLERS['design ack']!(context([['items', ' i-1, ,i-2 ']], call))
    expect(call).toHaveBeenLastCalledWith('design.ack', {
      from: 'term_agent',
      id: 'd1',
      items: ['i-1', 'i-2']
    })
  })

  it('prints each pending item and the ack command in text mode', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const call = vi.fn().mockResolvedValue({
      id: '1',
      ok: true,
      result: {
        items: [
          {
            id: 'i-1',
            kind: 'answer',
            createdAt: 1,
            decisionId: 'd-1',
            question: 'Pay how?',
            selected: ['Pix'],
            note: 'cheaper',
            block: { id: 'b1', title: 'Click' }
          },
          { id: 'i-2', kind: 'comment', createdAt: 2, messageId: 'm-1', text: 'Why?' }
        ],
        ackCommand: 'dolphin design ack --id d1 --items i-1,i-2 --json'
      }
    })
    await DESIGN_HANDLERS['design inbox']!(context([], call, false))
    expect(call).toHaveBeenCalledWith('design.inbox', { from: 'term_agent', id: 'd1' })
    const printed = log.mock.calls.flat().join('\n')
    expect(printed).toContain('i-1 answer to d-1 on block b1 (Click): Pay how?')
    expect(printed).toContain('selected: Pix')
    expect(printed).toContain('note: cheaper')
    expect(printed).toContain('i-2 comment m-1: Why?')
    expect(printed).toContain('When done: dolphin design ack --id d1 --items i-1,i-2 --json')
  })
})
