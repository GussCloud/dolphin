import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DolphinProfileAuthStatus } from '../../../../shared/dolphin-profiles'
import { createTestStore } from '../../store/slices/store-test-helpers'

const { storeHolder } = vi.hoisted(() => ({
  storeHolder: { current: null as { getState: () => unknown } | null }
}))

vi.mock('../../store', () => ({
  useAppStore: { getState: () => storeHolder.current?.getState() }
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))

import { registerDolphinProfileAuthIpcBridge } from './dolphin-profile-auth-ipc-bridge'

const connectedAuthStatus: DolphinProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted'
}

const reconnectRequiredAuthStatus: DolphinProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'reconnect-required',
  persistence: 'encrypted'
}

describe('dolphin profile auth IPC bridge', () => {
  let listener: (() => void) | null = null
  const unsubscribe = vi.fn()
  const authStatus = vi.fn()

  beforeEach(() => {
    listener = null
    unsubscribe.mockClear()
    authStatus.mockReset()
    vi.stubGlobal('window', {
      api: {
        dolphinProfiles: {
          authStatus,
          onAuthStatusChanged: (callback: () => void) => {
            listener = callback
            return unsubscribe
          }
        }
      }
    })
  })

  it('re-fetches auth status on the push, flipping connected to reconnect-required', async () => {
    authStatus.mockResolvedValue(connectedAuthStatus)
    const store = createTestStore()
    storeHolder.current = store
    await store.getState().fetchDolphinProfileAuthStatus()
    expect(store.getState().dolphinProfileAuthStatus).toEqual(connectedAuthStatus)

    const unsubs: (() => void)[] = []
    registerDolphinProfileAuthIpcBridge(unsubs)
    authStatus.mockResolvedValue(reconnectRequiredAuthStatus)
    listener?.()
    await vi.waitFor(() =>
      expect(store.getState().dolphinProfileAuthStatus).toEqual(reconnectRequiredAuthStatus)
    )

    unsubs.forEach((dispose) => dispose())
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('skips registration when the preload bridge does not expose the event', () => {
    vi.stubGlobal('window', { api: { dolphinProfiles: { authStatus } } })
    const unsubs: (() => void)[] = []

    registerDolphinProfileAuthIpcBridge(unsubs)

    expect(unsubs).toHaveLength(0)
  })
})
