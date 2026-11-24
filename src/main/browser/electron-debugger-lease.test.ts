import { describe, expect, it, vi } from 'vitest'
import {
  acquireElectronDebugger,
  type ElectronDebuggerLeaseOptions
} from './electron-debugger-lease'

function createWebContents(attached = false) {
  let isAttached = attached
  const destroyedListeners: (() => void)[] = []
  return {
    destroyedListeners,
    isDestroyed: vi.fn(() => false),
    setBackgroundThrottling: vi.fn(),
    once: vi.fn((event: string, listener: () => void) => {
      if (event === 'destroyed') {
        destroyedListeners.push(listener)
      }
    }),
    removeListener: vi.fn((event: string, listener: () => void) => {
      const index = destroyedListeners.indexOf(listener)
      if (event === 'destroyed' && index !== -1) {
        destroyedListeners.splice(index, 1)
      }
    }),
    debugger: {
      isAttached: vi.fn(() => isAttached),
      attach: vi.fn(() => {
        isAttached = true
      }),
      detach: vi.fn(() => {
        isAttached = false
      })
    }
  }
}

function leaseOn(
  webContents: ReturnType<typeof createWebContents>,
  options?: ElectronDebuggerLeaseOptions
) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every WebContents member the lease touches.
  return acquireElectronDebugger(webContents as never, options)
}

describe('electron debugger lease', () => {
  it('detaches only after the final lease releases', () => {
    const webContents = createWebContents()

    const first = acquireElectronDebugger(webContents as never)
    const second = acquireElectronDebugger(webContents as never)

    first.release()
    expect(webContents.debugger.detach).not.toHaveBeenCalled()

    second.release()
    expect(webContents.debugger.attach).toHaveBeenCalledTimes(1)
    expect(webContents.debugger.detach).toHaveBeenCalledTimes(1)
  })

  it('does not detach a debugger it did not attach', () => {
    const webContents = createWebContents(true)

    const lease = acquireElectronDebugger(webContents as never)
    lease.release()

    expect(webContents.debugger.attach).not.toHaveBeenCalled()
    expect(webContents.debugger.detach).not.toHaveBeenCalled()
  })

  it('keeps a hidden guest unthrottled only while a lease is held', () => {
    const webContents = createWebContents()

    const first = leaseOn(webContents)
    const second = leaseOn(webContents)
    expect(webContents.setBackgroundThrottling.mock.calls).toEqual([[false]])

    first.release()
    expect(webContents.setBackgroundThrottling.mock.calls).toEqual([[false]])
    second.release()
    expect(webContents.setBackgroundThrottling.mock.calls).toEqual([[false], [true]])
    expect(webContents.destroyedListeners).toHaveLength(0)
  })

  it('drops the rendering hold when the guest is destroyed before release', () => {
    const webContents = createWebContents()

    const lease = leaseOn(webContents)
    webContents.isDestroyed.mockReturnValue(true)
    expect(webContents.destroyedListeners).toHaveLength(1)
    webContents.destroyedListeners[0]()
    expect(webContents.setBackgroundThrottling.mock.calls).toEqual([[false]])
    expect(() => lease.release()).not.toThrow()
    expect(webContents.setBackgroundThrottling.mock.calls).toEqual([[false]])
  })

  it('does not hold rendering when the attach fails', () => {
    const webContents = createWebContents()
    webContents.debugger.attach.mockImplementation(() => {
      throw new Error('DevTools already attached')
    })

    expect(() => leaseOn(webContents)).toThrow()
    expect(webContents.setBackgroundThrottling).not.toHaveBeenCalled()
  })

  it('leaves throttling alone for a lease that opts out of holding rendering', () => {
    const webContents = createWebContents()

    const lease = leaseOn(webContents, { holdRendering: false })
    lease.release()

    expect(webContents.setBackgroundThrottling).not.toHaveBeenCalled()
  })
})
