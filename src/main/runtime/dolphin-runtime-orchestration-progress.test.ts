import { describe, expect, it, vi } from 'vitest'
import { DolphinRuntimeService } from './dolphin-runtime'

describe('DolphinRuntimeService orchestration progress', () => {
  it('signals progress for a worker_done and stops after unsubscribe', () => {
    const runtime = new DolphinRuntimeService()
    const listener = vi.fn()
    const unsubscribe = runtime.subscribeOrchestrationProgress(listener)
    runtime.notifyMessageArrived('run:run_1', 'heartbeat')
    expect(listener).not.toHaveBeenCalled()
    runtime.notifyMessageArrived('run:run_1', 'worker_done')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    runtime.notifyOrchestrationProgress()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps notifying when an observer throws', () => {
    const runtime = new DolphinRuntimeService()
    const after = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    runtime.subscribeOrchestrationProgress(() => {
      throw new Error('boom')
    })
    runtime.subscribeOrchestrationProgress(after)
    expect(() => runtime.notifyOrchestrationProgress()).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
  })
})
