import { describe, expect, it, vi } from 'vitest'
import { emitDolphinCloudSignedIn, onDolphinCloudSignedIn } from './profile-cloud-sign-in-events'

describe('Dolphin cloud sign-in events', () => {
  it('notifies listeners after the current turn and isolates failures', async () => {
    const order: string[] = []
    const stopFailing = onDolphinCloudSignedIn(() => {
      throw new Error('boom')
    })
    const stop = onDolphinCloudSignedIn(() => order.push('listener'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    emitDolphinCloudSignedIn()
    order.push('caller')
    await Promise.resolve()
    expect(order).toEqual(['caller', 'listener'])
    stop()
    stopFailing()
    emitDolphinCloudSignedIn()
    await Promise.resolve()
    expect(order).toEqual(['caller', 'listener'])
    warn.mockRestore()
  })
})
