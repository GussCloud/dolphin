import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Rect = { x: number; y: number; width: number; height: number }

const { instances, BrowserWindowMock, getAllDisplaysMock, sendToTrustedUIRendererMock, appMock } =
  vi.hoisted(() => {
    const created: FakeWindow[] = []

    class FakeWindow {
      options: Electron.BrowserWindowConstructorOptions
      private handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
      destroyed = false
      minimized = false
      bounds: Rect = { x: 100, y: 100, width: 960, height: 720 }
      webContents = {
        id: created.length + 1,
        send: vi.fn(),
        isDestroyed: () => this.destroyed,
        session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
        on: vi.fn(),
        setZoomLevel: vi.fn(),
        getZoomLevel: vi.fn(() => 0)
      }
      focus = vi.fn()
      show = vi.fn()
      showInactive = vi.fn()
      restore = vi.fn()
      loadURL = vi.fn()
      loadFile = vi.fn()
      close = vi.fn(() => {
        this.destroyed = true
        this.emit('close')
        this.emit('closed')
      })

      constructor(options: Electron.BrowserWindowConstructorOptions) {
        this.options = options
        created.push(this)
      }
      on(event: string, cb: (...args: unknown[]) => void): this {
        ;(this.handlers[event] ||= []).push(cb)
        return this
      }
      once(event: string, cb: (...args: unknown[]) => void): this {
        return this.on(event, cb)
      }
      emit(event: string, ...args: unknown[]): void {
        for (const cb of this.handlers[event] ?? []) {
          cb(...args)
        }
      }
      isDestroyed(): boolean {
        return this.destroyed
      }
      isFocused(): boolean {
        return false
      }
      isMinimized(): boolean {
        return this.minimized
      }
      isFullScreen(): boolean {
        return false
      }
      isVisible(): boolean {
        return false
      }
      getBounds(): Rect {
        return this.bounds
      }
    }

    return {
      instances: created,
      BrowserWindowMock: FakeWindow,
      getAllDisplaysMock: vi.fn((): { workArea: Rect }[] => []),
      sendToTrustedUIRendererMock: vi.fn(),
      appMock: { on: vi.fn(), removeListener: vi.fn() }
    }
  })

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: BrowserWindowMock,
  nativeTheme: { shouldUseDarkColors: false },
  screen: { getAllDisplays: getAllDisplaysMock }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('../ipc/ui', () => ({ sendToTrustedUIRenderer: sendToTrustedUIRendererMock }))
vi.mock('./privileged-window-navigation', () => ({
  installPrivilegedWindowNavigationPolicy: vi.fn()
}))

import {
  closeDesignPopout,
  createOrFocusDesignPopout,
  getDesignPopoutWindow,
  isDesignPopoutRenderer
} from './design-popout-window'
import { getDashboardPopoutWindow } from './dashboard-popout-window'

type FakeWindow = InstanceType<typeof BrowserWindowMock>

const PRIMARY = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } }
// A second monitor to the right of the primary one.
const SECONDARY = { workArea: { x: 1920, y: 0, width: 2560, height: 1440 } }

function makeStore(ui: Record<string, unknown> = {}) {
  return { getUI: () => ui, updateUI: vi.fn(), onUIChanged: vi.fn(() => vi.fn()) }
}

function open(store = makeStore()): FakeWindow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the electron mock constructs FakeWindow, so the returned BrowserWindow is one.
  return createOrFocusDesignPopout(store as never) as unknown as FakeWindow
}

beforeEach(() => {
  instances.length = 0
  vi.stubEnv('DOLPHIN_BACKGROUND_LAUNCH', undefined)
  vi.stubEnv('DOLPHIN_E2E_HEADLESS', undefined)
  vi.stubEnv('DOLPHIN_E2E_HEADFUL', undefined)
  vi.stubEnv('ELECTRON_RENDERER_URL', '')
  getAllDisplaysMock.mockReturnValue([PRIMARY])
})

afterEach(() => {
  closeDesignPopout()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('createOrFocusDesignPopout', () => {
  it('creates its own native-frame window, session and HTML entry', () => {
    const win = open()
    expect(win.options.title).toBe('Dolphin — Design')
    expect(win.options.frame).toBeUndefined()
    expect(win.options.webPreferences?.partition).toBe('dolphin-design-popout')
    expect(win.options.webPreferences?.sandbox).toBe(true)
    expect(win.options.webPreferences?.webviewTag).toBe(false)
    expect(String(win.loadFile.mock.calls[0][0])).toMatch(/renderer[\\/]design-popout\.html$/)
    const permission = vi.fn()
    win.webContents.session.setPermissionRequestHandler.mock.calls[0][0](null, 'media', permission)
    expect(permission).toHaveBeenCalledWith(false)
    expect(sendToTrustedUIRendererMock).toHaveBeenCalledWith('designPopout:openChanged', true)
  })

  it('is a singleton independent of the dashboard pop-out', () => {
    const first = open()
    const second = open()
    expect(second).toBe(first)
    expect(instances).toHaveLength(1)
    expect(first.focus).toHaveBeenCalledOnce()
    expect(getDashboardPopoutWindow()).toBeNull()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: isRenderer compares identity only, so the fake webContents suffices.
    expect(isDesignPopoutRenderer(first.webContents as never)).toBe(true)
  })

  it('restores bounds saved on a second monitor', () => {
    getAllDisplaysMock.mockReturnValue([PRIMARY, SECONDARY])
    open(makeStore({ designPopoutBounds: { x: 2200, y: 100, width: 1200, height: 900 } }))
    expect(instances[0].options).toMatchObject({ x: 2200, y: 100, width: 1200, height: 900 })
  })

  it('discards bounds from a monitor that is no longer connected', () => {
    // The secondary monitor was unplugged since the bounds were saved.
    open(makeStore({ designPopoutBounds: { x: 2200, y: 100, width: 1200, height: 900 } }))
    const opts = instances[0].options
    expect(opts.x).toBeUndefined()
    expect(opts.y).toBeUndefined()
    expect(opts.width).toBe(960)
    expect(opts.height).toBe(720)
  })

  it('ignores the dashboard pop-out bounds', () => {
    open(makeStore({ dashboardPopoutBounds: { x: 300, y: 300, width: 1000, height: 800 } }))
    expect(instances[0].options.x).toBeUndefined()
  })

  it('persists moved bounds under its own key', () => {
    vi.useFakeTimers()
    try {
      const store = makeStore()
      const win = open(store)
      win.bounds = { x: 2000, y: 50, width: 1100, height: 800 }
      win.emit('move')
      vi.advanceTimersByTime(500)
      expect(store.updateUI).toHaveBeenCalledWith({ designPopoutBounds: win.bounds })
    } finally {
      vi.useRealTimers()
    }
  })

  it('reveals without focus and never refocuses in a background launch', () => {
    vi.stubEnv('DOLPHIN_BACKGROUND_LAUNCH', '1')
    const win = open()
    win.emit('ready-to-show')
    expect(win.show).not.toHaveBeenCalled()
    expect(win.focus).not.toHaveBeenCalled()
    open()
    expect(win.focus).not.toHaveBeenCalled()
  })

  it('shows on ready-to-show in a normal launch', () => {
    const win = open()
    win.emit('ready-to-show')
    expect(win.show).toHaveBeenCalledOnce()
  })

  it('closes with the main window and reports the closed state', () => {
    const win = open()
    closeDesignPopout()
    expect(win.close).toHaveBeenCalledOnce()
    expect(getDesignPopoutWindow()).toBeNull()
    expect(sendToTrustedUIRendererMock).toHaveBeenLastCalledWith('designPopout:openChanged', false)
  })
})
