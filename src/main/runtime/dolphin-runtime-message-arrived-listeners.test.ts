import { describe, expect, it, vi } from 'vitest'
import { DolphinRuntimeService } from './dolphin-runtime'

describe('DolphinRuntimeService.subscribeMessageArrived', () => {
  it('tells observers about each arrived message until they unsubscribe', () => {
    const runtime = new DolphinRuntimeService()
    const listener = vi.fn()
    const unsubscribe = runtime.subscribeMessageArrived(listener)
    runtime.notifyMessageArrived('run:run_1', 'worker_done')
    expect(listener).toHaveBeenCalledWith('run:run_1', 'worker_done')
    unsubscribe()
    runtime.notifyMessageArrived('run:run_1', 'worker_done')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps delivering when an observer throws', () => {
    const runtime = new DolphinRuntimeService()
    const after = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    runtime.subscribeMessageArrived(() => {
      throw new Error('boom')
    })
    runtime.subscribeMessageArrived(after)
    expect(() => runtime.notifyMessageArrived('run:run_1', 'worker_done')).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
  })
})
