import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  _resetTelegramQuitShutdown,
  registerTelegramBridgeQuitFallback,
  runTelegramQuitShutdown,
  setTelegramQuitShutdown
} from './telegram-quit-shutdown'

afterEach(() => _resetTelegramQuitShutdown())

describe('runTelegramQuitShutdown', () => {
  it('runs the shutdown once for both quit callers', async () => {
    const shutdown = vi.fn(async () => {})
    setTelegramQuitShutdown(shutdown)
    const first = runTelegramQuitShutdown()
    const second = runTelegramQuitShutdown()
    expect(second).toBe(first)
    await first
    expect(shutdown).toHaveBeenCalledTimes(1)
  })

  it('still disposes the bridge when the relay never started', async () => {
    const bridge = { dispose: vi.fn() }
    registerTelegramBridgeQuitFallback(bridge)
    await runTelegramQuitShutdown()
    expect(bridge.dispose).toHaveBeenCalledTimes(1)
  })

  it('lets the relay step replace the fallback', async () => {
    const bridge = { dispose: vi.fn() }
    registerTelegramBridgeQuitFallback(bridge)
    const upgraded = vi.fn(async () => bridge.dispose())
    setTelegramQuitShutdown(upgraded)
    await runTelegramQuitShutdown()
    expect(upgraded).toHaveBeenCalledTimes(1)
    expect(bridge.dispose).toHaveBeenCalledTimes(1)
  })
})
