import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { on: vi.fn(), handle: vi.fn() } }))

import { installWindowsSessionEndFlush } from './main-window-session-end-flush'
import {
  clearCrashBreadcrumbsForTest,
  getCrashBreadcrumbSnapshot
} from '../crash-reporting/crash-breadcrumb-store'

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true
  })
}

function createWindow() {
  const handlers: Record<string, ((event: { preventDefault: () => void }) => void)[]> = {}
  const preventDefault = vi.fn()
  const window = {
    on: vi.fn((name: string, handler: (event: { preventDefault: () => void }) => void) => {
      ;(handlers[name] ??= []).push(handler)
    })
  }
  const emit = (name: string): void => {
    for (const handler of handlers[name] ?? []) {
      handler({ preventDefault })
    }
  }
  return { window, emit, preventDefault, handlers }
}

describe('installWindowsSessionEndFlush', () => {
  beforeEach(() => clearCrashBreadcrumbsForTest())
  afterEach(() => setPlatform(originalPlatform))

  it('flushes pending durable state on query-session-end without vetoing the OS', async () => {
    setPlatform('win32')
    const store = { flushPendingOrThrowAsync: vi.fn(() => Promise.resolve()) }
    const { window, emit, preventDefault } = createWindow()

    installWindowsSessionEndFlush(window, store)
    emit('query-session-end')

    expect(store.flushPendingOrThrowAsync).toHaveBeenCalledTimes(1)
    expect(store.flushPendingOrThrowAsync).toHaveBeenCalledWith(
      expect.objectContaining({ drainToStableGeneration: false })
    )
    expect(preventDefault).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(getCrashBreadcrumbSnapshot()).toEqual([]))
  })

  it('flushes once when session-end follows query-session-end, and again on a later cycle', async () => {
    setPlatform('win32')
    let resolveFlush: () => void = () => {}
    const store = {
      flushPendingOrThrowAsync: vi.fn(
        () => new Promise<void>((resolve) => (resolveFlush = resolve))
      )
    }
    const { window, emit } = createWindow()

    installWindowsSessionEndFlush(window, store)
    emit('query-session-end')
    emit('session-end')
    expect(store.flushPendingOrThrowAsync).toHaveBeenCalledTimes(1)

    resolveFlush()
    await vi.waitFor(() => {
      emit('session-end')
      expect(store.flushPendingOrThrowAsync).toHaveBeenCalledTimes(2)
    })
  })

  it('swallows a failed flush and records it as a durable breadcrumb', async () => {
    setPlatform('win32')
    const store = {
      flushPendingOrThrowAsync: vi.fn(() => Promise.reject(new Error('disk')))
    }
    const { window, emit } = createWindow()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    installWindowsSessionEndFlush(window, store)
    expect(() => emit('session-end')).not.toThrow()

    await vi.waitFor(() =>
      expect(getCrashBreadcrumbSnapshot()).toEqual([
        expect.objectContaining({
          name: 'system_session_end_flush_failed',
          data: expect.objectContaining({ signal: 'session-end' })
        })
      ])
    )
  })

  it.each(['darwin', 'linux'] as const)('installs nothing on %s', (platform) => {
    setPlatform(platform)
    const store = {
      flushPendingOrThrowAsync: vi.fn(() => Promise.resolve())
    }
    const { window, emit } = createWindow()

    installWindowsSessionEndFlush(window, store)
    emit('query-session-end')

    expect(window.on).not.toHaveBeenCalled()
    expect(store.flushPendingOrThrowAsync).not.toHaveBeenCalled()
  })
})
