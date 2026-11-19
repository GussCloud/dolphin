import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DESIGN_MAX_CANVAS_VERSIONS,
  DESIGN_MAX_EVENTS,
  type DesignCanvas
} from '../../shared/design-types'
import { DesignStore, toDesignListEntry, type DesignCreate } from './design-store'

const INPUT: DesignCreate = {
  name: 'Checkout',
  request: 'Pay by card',
  agent: 'claude',
  repoId: null
}
const CANVAS: DesignCanvas = {
  groups: [{ id: 'g1', title: 'Start', blocks: [{ id: 'b1', kind: 'trigger', title: 'Click' }] }],
  edges: []
}

describe('DesignStore', () => {
  let dir: string
  let file: string
  let clock: number

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-store-'))
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

  it('creates a draft and reloads it from disk with its binding and events', () => {
    const designs = store()
    const created = designs.create(INPUT)
    expect(created).toMatchObject({ status: 'draft', paneKey: null, worktreeId: null })
    designs.bindAgent(created.id, { paneKey: 'tab:leaf', worktreeId: 'wt-1' })
    const reloaded = store().get(created.id)
    expect(reloaded).toMatchObject({ paneKey: 'tab:leaf', worktreeId: 'wt-1' })
    expect(reloaded?.events.map((event) => event.kind)).toEqual(['created', 'agent-bound'])
    if (process.platform !== 'win32') {
      expect(statSync(file).mode & 0o777).toBe(0o600)
    }
  })

  it('records a rebind to another pane', () => {
    const designs = store()
    const { id } = designs.create(INPUT)
    designs.bindAgent(id, { paneKey: 'a', worktreeId: null })
    const rebound = designs.bindAgent(id, { paneKey: 'b', worktreeId: null })
    expect(rebound.paneKey).toBe('b')
    expect(rebound.events.at(-1)).toMatchObject({ kind: 'agent-bound', detail: 'rebound' })
  })

  it('numbers canvas versions and keeps only the newest ones', () => {
    const designs = store()
    const { id } = designs.create(INPUT)
    let version = 0
    for (let index = 0; index < DESIGN_MAX_CANVAS_VERSIONS + 3; index += 1) {
      version = designs.setCanvas(id, CANVAS).version
    }
    const design = store().get(id)!
    expect(version).toBe(DESIGN_MAX_CANVAS_VERSIONS + 3)
    expect(design.canvasVersions).toHaveLength(DESIGN_MAX_CANVAS_VERSIONS)
    expect(design.canvasVersions[0]?.version).toBe(4)
    expect(toDesignListEntry(design)).toMatchObject({ canvasVersion: version, groupCount: 1 })
    expect(toDesignListEntry(design)).not.toHaveProperty('canvasVersions')
  })

  it('caps the event log', () => {
    const designs = store()
    const { id } = designs.create(INPUT)
    for (let index = 0; index < DESIGN_MAX_EVENTS + 10; index += 1) {
      designs.rename(id, `Name ${index}`)
    }
    const events = JSON.parse(readFileSync(file, 'utf-8'))[0].events
    expect(events).toHaveLength(DESIGN_MAX_EVENTS)
    expect(events.at(-1)).toMatchObject({ kind: 'renamed', actor: 'user' })
  })

  it('refuses a status move the transition table does not allow', () => {
    const designs = store()
    const { id } = designs.create(INPUT)
    expect(() => designs.setStatus(id, 'done', 'user')).toThrow('design_invalid_transition')
    expect(designs.setStatus(id, 'in-progress', 'agent').events.at(-1)).toMatchObject({
      kind: 'status-changed',
      actor: 'agent',
      detail: 'draft -> in-progress'
    })
    expect(store().get(id)?.status).toBe('in-progress')
  })

  it('drops corrupt history entries on reload but keeps the design', () => {
    const designs = store()
    const { id } = designs.create(INPUT)
    designs.setCanvas(id, CANVAS)
    designs.setCanvas(id, CANVAS)
    const [stored] = JSON.parse(readFileSync(file, 'utf-8'))
    stored.canvasVersions[0].canvas.groups[0].blocks[0].kind = 'banana'
    stored.canvasVersions.push({ version: 3 })
    stored.events.push(
      { kind: 'exploded', actor: 'agent', at: 1 },
      { kind: 'renamed', actor: 'bot', at: 1 }
    )
    writeFileSync(file, JSON.stringify([stored]))
    const reloaded = store().get(id)!
    expect(reloaded.canvasVersions.map((entry) => entry.version)).toEqual([2])
    expect(reloaded.events.map((event) => event.kind)).toEqual([
      'created',
      'canvas-set',
      'canvas-set'
    ])
  })

  it('notifies subscribers of every write', () => {
    const designs = store()
    const seen: string[] = []
    const dispose = designs.subscribe((design) => seen.push(design.status))
    const { id } = designs.create(INPUT)
    designs.setStatus(id, 'discarded', 'user')
    dispose()
    designs.setStatus(id, 'draft', 'user')
    expect(seen).toEqual(['draft', 'discarded'])
  })
})
