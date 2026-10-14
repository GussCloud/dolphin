import { describe, expect, it } from 'vitest'
import { toRuntimeSpawnReply } from './spawn-reply'

describe('toRuntimeSpawnReply', () => {
  it('forwards that the provider attached a still-live session', () => {
    expect(toRuntimeSpawnReply({ id: 'pty-1', reattachedLiveSession: true })).toEqual({
      id: 'pty-1',
      reattachedLiveSession: true
    })
  })

  it('omits the flag for a fresh spawn', () => {
    expect(toRuntimeSpawnReply({ id: 'pty-1' })).toEqual({ id: 'pty-1' })
  })
})
