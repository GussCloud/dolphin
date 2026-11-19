import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send } }] }
}))

import { startDesignRendererBroadcast } from './design-renderer-broadcast'

describe('startDesignRendererBroadcast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    send.mockClear()
  })

  it('sends one event to windows and clients for a burst of writes', () => {
    const publishToClients = vi.fn()
    let notify = (): void => {}
    startDesignRendererBroadcast((listener) => ((notify = listener), () => {}), publishToClients)
    notify()
    notify()
    vi.advanceTimersByTime(300)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('designs:changed')
    expect(publishToClients).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes and drops a pending event when stopped', () => {
    const unsubscribe = vi.fn()
    let notify = (): void => {}
    const stop = startDesignRendererBroadcast((listener) => ((notify = listener), unsubscribe))
    notify()
    stop()
    vi.advanceTimersByTime(300)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()
  })
})
