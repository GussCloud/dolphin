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
