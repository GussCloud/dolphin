import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pendingDesignInbox, type DesignCanvas } from '../../shared/design-types'
import { DesignStore, toDesignListEntry } from './design-store'
import { expandDesignInbox } from './design-inbox'

const CANVAS: DesignCanvas = {
  groups: [{ id: 'g1', title: 'Start', blocks: [{ id: 'b1', kind: 'trigger', title: 'Click' }] }],
  edges: []
}

describe('DesignStore status and completion', () => {
  let dir: string
  let file: string
  let clock: number

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-done-'))
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

  function boundDesign(designs: DesignStore, bound = true): string {
    const { id } = designs.create({
      name: 'Checkout',
      request: 'Pay',
      agent: 'claude',
      repoId: null
    })
    if (bound) {
      designs.bindAgent(id, { paneKey: 'pane-a', worktreeId: null })
    }
    designs.setCanvas(id, CANVAS)
    designs.setCanvas(id, CANVAS)
    return id
  }

  it('tells a bound agent to implement the approved canvas version', () => {
    const designs = store()
    const id = boundDesign(designs)
    designs.setStatus(id, 'in-progress')
    const [item] = pendingDesignInbox(designs.get(id)!)
    expect(item).toMatchObject({ kind: 'status', refId: 'in-progress', canvasVersion: 2 })
    const [entry] = expandDesignInbox(designs.get(id)!)
    expect(entry).toMatchObject({ kind: 'status', status: 'in-progress', canvasVersion: 2 })
    expect(entry).toHaveProperty('text', expect.stringContaining('canvas version 2'))
    expect(entry).toHaveProperty(
      'text',
      expect.stringContaining(`dolphin design complete --id ${id}`)
    )
  })

  it('adds no status item while no agent is bound', () => {
    const designs = store()
    const id = boundDesign(designs, false)
    designs.setStatus(id, 'in-progress')
    expect(designs.get(id)!.inbox).toEqual([])
  })

  it('keeps only the latest unread status move and survives reload', () => {
    const designs = store()
    const id = boundDesign(designs)
    designs.setStatus(id, 'in-progress')
    designs.setStatus(id, 'discarded')
    designs.addComment(id, { text: 'why' })
    const reloaded = store().get(id)!
    expect(pendingDesignInbox(reloaded).map((item) => `${item.kind}:${item.refId}`)).toEqual([
      'status:discarded',
      expect.stringMatching(/^comment:m-/)
    ])
    expect(expandDesignInbox(reloaded)[0]).toMatchObject({ kind: 'status', status: 'discarded' })
  })

  it('records the completion, replaces it on a second report and lists it as pending', () => {
    const designs = store()
    const id = boundDesign(designs)
    expect(() => designs.complete(id, 'Built it')).toThrow(/only an approved/)
    designs.setStatus(id, 'in-progress')
    designs.complete(id, 'Built it')
    const second = designs.complete(id, 'Built it, with tests')
    expect(second.completion).toMatchObject({ summary: 'Built it, with tests', canvasVersion: 2 })
    expect(second.events.at(-1)).toMatchObject({ kind: 'completion-requested', actor: 'agent' })
    expect(toDesignListEntry(second)).toMatchObject({ completionPending: true })
    expect(toDesignListEntry(second)).not.toHaveProperty('completion')
    expect(store().get(id)!.completion?.summary).toBe('Built it, with tests')
  })

  it('confirms done only with a completion and tells the agent there is nothing left', () => {
    const designs = store()
    const id = boundDesign(designs)
    designs.setStatus(id, 'in-progress')
    expect(() => designs.confirmDone(id)).toThrow(/no completion/)
    designs.complete(id, 'Built it')
    const done = designs.confirmDone(id)
    expect(done.status).toBe('done')
    expect(done.completion).toBeUndefined()
    expect(done.events.at(-1)).toMatchObject({ kind: 'completion-confirmed', actor: 'user' })
    expect(expandDesignInbox(done).map((entry) => entry.kind === 'status' && entry.status)).toEqual(
      ['done']
    )
    expect(toDesignListEntry(done).completionPending).toBe(false)
  })

  it('declines with a general comment the agent reads and keeps the design in progress', () => {
    const designs = store()
    const id = boundDesign(designs)
    designs.setStatus(id, 'in-progress')
    expect(() => designs.declineDone(id, 'Missing tests')).toThrow(/no completion/)
    designs.complete(id, 'Built it')
    const declined = designs.declineDone(id, 'Missing tests')
    expect(declined.status).toBe('in-progress')
    expect(declined.completion).toBeUndefined()
    expect(declined.messages.at(-1)).toMatchObject({ author: 'user', text: 'Missing tests' })
    expect(declined.messages.at(-1)).not.toHaveProperty('blockId')
    expect(declined.events.at(-1)).toMatchObject({
      kind: 'completion-declined',
      actor: 'user',
      detail: declined.messages.at(-1)!.id
    })
    expect(expandDesignInbox(declined).at(-1)).toMatchObject({
      kind: 'comment',
      text: 'Missing tests'
    })
  })

  it('clears a pending completion when the user moves the design away from in progress', () => {
    const designs = store()
    const id = boundDesign(designs)
    designs.setStatus(id, 'in-progress')
    designs.complete(id, 'Built it')
    expect(designs.setStatus(id, 'draft').completion).toBeUndefined()
    expect(JSON.parse(readFileSync(file, 'utf-8'))[0]).not.toHaveProperty('completion')
  })

  it('omits the completion field, never null, on every clearing path and on reload', () => {
    const designs = store()
    const id = boundDesign(designs)
    const storedDesign = () => JSON.parse(readFileSync(file, 'utf-8'))[0]
    designs.setStatus(id, 'in-progress')
    designs.complete(id, 'Built it')
    const declined = designs.declineDone(id, 'More')
    expect(declined).not.toHaveProperty('completion')
    expect(storedDesign()).not.toHaveProperty('completion')
    designs.complete(id, 'Built it')
    const done = designs.confirmDone(id)
    expect(done).not.toHaveProperty('completion')
    expect(storedDesign()).not.toHaveProperty('completion')

    writeFileSync(
      file,
      JSON.stringify([{ ...storedDesign(), status: 'in-progress', completion: null }])
    )
    const reloaded = store()
    expect(reloaded.get(id)).not.toHaveProperty('completion')
    reloaded.rename(id, 'Renamed')
    expect(storedDesign()).not.toHaveProperty('completion')
  })

  it('drops an invalid or out-of-stage completion and bad status items on reload', () => {
    const designs = store()
    const id = boundDesign(designs)
    designs.setStatus(id, 'in-progress')
    designs.complete(id, 'Built it')
    const [stored] = JSON.parse(readFileSync(file, 'utf-8'))
    stored.inbox.push({ id: 'i-bad', kind: 'status', refId: 'banana', createdAt: 1 })
    writeFileSync(file, JSON.stringify([stored]))
    const reloaded = store().get(id)!
    expect(reloaded.completion?.summary).toBe('Built it')
    expect(reloaded.inbox.map((item) => item.id)).not.toContain('i-bad')

    writeFileSync(file, JSON.stringify([{ ...stored, completion: { summary: '', at: 1 } }]))
    expect(store().get(id)!.completion).toBeUndefined()
    writeFileSync(file, JSON.stringify([{ ...stored, status: 'draft' }]))
    expect(store().get(id)!.completion).toBeUndefined()
  })
})
