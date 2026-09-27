import { describe, expect, it } from 'vitest'
import { canTransitionSessionLifecycle, projectDaemonSessionLifecycle } from './session-lifecycle'

describe('canTransitionSessionLifecycle', () => {
  it('follows the documented happy path', () => {
    expect(canTransitionSessionLifecycle('creating', 'starting')).toBe(true)
    expect(canTransitionSessionLifecycle('starting', 'running')).toBe(true)
    expect(canTransitionSessionLifecycle('running', 'stopping')).toBe(true)
    expect(canTransitionSessionLifecycle('stopping', 'terminated')).toBe(true)
    expect(canTransitionSessionLifecycle('terminated', 'reaped')).toBe(true)
  })

  it('never lets a terminated session return straight to running', () => {
    expect(canTransitionSessionLifecycle('terminated', 'running')).toBe(false)
    expect(canTransitionSessionLifecycle('terminated', 'restoring')).toBe(true)
    expect(canTransitionSessionLifecycle('restoring', 'running')).toBe(true)
  })

  it('treats a repeated state as a no-op transition', () => {
    expect(canTransitionSessionLifecycle('stopping', 'stopping')).toBe(true)
  })

  it('refuses to stop a session that is already gone', () => {
    expect(canTransitionSessionLifecycle('reaped', 'stopping')).toBe(false)
  })
})

describe('projectDaemonSessionLifecycle', () => {
  it('maps daemon states onto the lifecycle vocabulary', () => {
    expect(projectDaemonSessionLifecycle({ state: 'running', isAlive: true })).toBe('running')
    expect(projectDaemonSessionLifecycle({ state: 'exiting', isAlive: true })).toBe('stopping')
    expect(projectDaemonSessionLifecycle({ state: 'spawning', isAlive: true })).toBe('starting')
    expect(projectDaemonSessionLifecycle({ state: 'running', isAlive: false })).toBe('terminated')
  })
})
