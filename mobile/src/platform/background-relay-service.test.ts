import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppStateStatus } from 'react-native'
import { setBackgroundRelayRetention } from '../transport/background-relay-retention'
import type { NativeBackgroundRelay } from './native-background-relay'
import { startBackgroundRelayService } from './background-relay-service'

vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: vi.fn() } }))
vi.mock('../storage/preferences', () => ({ loadBackgroundRelayRetention: async () => '15m' }))

function fixture() {
  let running = false
  const native: NativeBackgroundRelay = {
    start: vi.fn(() => (running = true)),
    stop: vi.fn(() => {
      running = false
    }),
    isRunning: () => running,
    enterBackground: vi.fn(),
    enterForeground: vi.fn(),
    isIgnoringBatteryOptimizations: () => true,
    requestIgnoreBatteryOptimizations: () => true,
    hasAutostartSettings: () => false,
    openAutostartSettings: () => true
  }
  let listener: ((state: AppStateStatus) => void) | null = null
  const appState: NonNullable<Parameters<typeof startBackgroundRelayService>[1]> = {
    currentState: 'active',
    addEventListener: (_type: 'change', next: (state: AppStateStatus) => void) => {
      listener = next
      return { remove: vi.fn() }
    }
  }
  const emit = (state: AppStateStatus): void => {
    appState.currentState = state
    listener?.(state)
  }
  return { native, appState, emit }
}

describe('startBackgroundRelayService', () => {
  afterEach(() => setBackgroundRelayRetention('off'))

  it('starts once the stored retention loads and arms the native window on background', async () => {
    const { native, appState, emit } = fixture()
    const stop = startBackgroundRelayService(native, appState)
    await vi.waitFor(() => expect(native.start).toHaveBeenCalledOnce())

    emit('background')
    expect(native.enterBackground).toHaveBeenCalledWith(15 * 60_000)

    emit('active')
    expect(native.start).toHaveBeenCalledOnce()
    expect(native.enterForeground).toHaveBeenCalled()
    stop()
  })

  it('stops the service when retention is turned off', async () => {
    const { native, appState } = fixture()
    const stop = startBackgroundRelayService(native, appState)
    await vi.waitFor(() => expect(native.start).toHaveBeenCalledOnce())

    setBackgroundRelayRetention('off')

    expect(native.stop).toHaveBeenCalled()
    expect(native.isRunning()).toBe(false)
    stop()
  })

  it('passes an unbounded window for always', async () => {
    const { native, appState, emit } = fixture()
    const stop = startBackgroundRelayService(native, appState)
    await vi.waitFor(() => expect(native.start).toHaveBeenCalledOnce())
    setBackgroundRelayRetention('always')

    emit('background')

    expect(native.enterBackground).toHaveBeenCalledWith(null)
    stop()
  })
})
