import { describe, expect, it } from 'vitest'
import { readySession, run } from './mobile-web-shell-session-test-fixtures'

/** A load the view refuses or never commits reports nothing, so only a clock ends the wait. */
describe('the view has to finish the document it was given', () => {
  it('arms the wait when a generation is put on screen', () => {
    expect(readySession().effects).toContainEqual({ kind: 'await-document-load' })
  })

  it('arms it again for a new document and for a remount', () => {
    const ready = readySession()
    expect(run(ready.session, { type: 'document-started' }).effects).toEqual([
      { kind: 'await-document-load' }
    ])
    expect(run(ready.session, { type: 'remounted', sessionId: 'session-two' }).effects).toEqual([
      { kind: 'await-document-load' }
    ])
  })

  it('deletes the cache and runs the flow again when no document ever finished', () => {
    const started = run(readySession().session, { type: 'document-started' })
    const step = run(started.session, { type: 'document-load-deadline' })
    expect(step.effects).toEqual([{ kind: 'delete-cache' }, { kind: 'open-cache' }])
    expect(step.session.state.kind).toBe('checking')
  })

  it('does nothing once the document finished or the page spoke', () => {
    const loaded = run(readySession().session, { type: 'document-loaded' })
    expect(run(loaded.session, { type: 'document-load-deadline' }).effects).toEqual([])
    const spoke = run(readySession().session, { type: 'page-ready', reports: [], accepts: [] })
    expect(run(spoke.session, { type: 'document-load-deadline' }).session.state.kind).toBe('ready')
  })

  it('drops the wait a replaced document left behind', () => {
    const ready = readySession()
    const armed = ready.session.flow
    const started = run(ready.session, { type: 'document-started' })
    const step = run(started.session, { type: 'document-load-deadline', flow: armed })
    expect(step.effects).toEqual([])
    expect(step.session.state.kind).toBe('ready')
  })

  it('makes the next document finish on its own', () => {
    const loaded = run(readySession().session, { type: 'document-loaded' })
    const started = run(loaded.session, { type: 'document-started' })
    expect(started.session.documentLoaded).toBe(false)
  })
})
