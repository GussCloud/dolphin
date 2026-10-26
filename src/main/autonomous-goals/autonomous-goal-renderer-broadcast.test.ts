import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send } }] }
}))

import { startAutonomousGoalRendererBroadcast } from './autonomous-goal-renderer-broadcast'

describe('startAutonomousGoalRendererBroadcast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    send.mockClear()
  })

  it('sends one change event for a burst from any source', () => {
    const notifiers: (() => void)[] = []
    startAutonomousGoalRendererBroadcast([
      (notify) => (notifiers.push(notify), () => {}),
      (notify) => (notifiers.push(notify), () => {})
    ])
    notifiers[0]()
    notifiers[1]()
    notifiers[1]()
    vi.advanceTimersByTime(300)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('autonomousGoals:changed')
  })

  it('unsubscribes every source and drops a pending event when stopped', () => {
    const unsubscribe = vi.fn()
    let notify = (): void => {}
    const stop = startAutonomousGoalRendererBroadcast([
      (listener) => ((notify = listener), unsubscribe)
    ])
    notify()
    stop()
    vi.advanceTimersByTime(300)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()
  })

  it('also publishes to paired clients on each flush', () => {
    const publishToClients = vi.fn()
    let notify = (): void => {}
    startAutonomousGoalRendererBroadcast(
      [(listener) => ((notify = listener), () => {})],
      publishToClients
    )
    notify()
    notify()
    vi.advanceTimersByTime(300)
    expect(publishToClients).toHaveBeenCalledTimes(1)
  })
})
