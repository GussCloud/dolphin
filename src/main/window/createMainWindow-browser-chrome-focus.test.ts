import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () =>
  (await import('./createMainWindow-test-harness')).electronModuleMock()
)
vi.mock('@electron-toolkit/utils', async () =>
  (await import('./createMainWindow-test-harness')).electronToolkitUtilsMock()
)
vi.mock('./macos-tahoe-release', async () =>
  (await import('./createMainWindow-test-harness')).macosTahoeReleaseMock()
)
vi.mock('../app-icon', async () => (await import('./createMainWindow-test-harness')).appIconMock())
vi.mock('../browser/browser-manager', async () =>
  (await import('./createMainWindow-test-harness')).browserManagerMock()
)

import { createMainWindow } from './createMainWindow'
import { ipcMain } from 'electron'
import { resetExpectedTeardownStateForTest } from '../crash-reporting/expected-teardown-state'
import { browserWindowMock, resetMainWindowMocks } from './createMainWindow-test-harness'
import type { KeybindingOverrides } from '../../shared/keybindings'

const isDarwin = process.platform === 'darwin'

function setUpWindow(keybindings?: KeybindingOverrides) {
  const windowHandlers: Record<string, (...args: unknown[]) => void> = {}
  const webContents = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      windowHandlers[event] = handler
    }),
    setZoomLevel: vi.fn(),
    setBackgroundThrottling: vi.fn(),
    invalidate: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    send: vi.fn(),
    isDevToolsOpened: vi.fn(),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn()
  }
  browserWindowMock.mockImplementation(function () {
    return {
      webContents,
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      getSize: vi.fn(() => [1200, 800]),
      setSize: vi.fn(),
      maximize: vi.fn(),
      show: vi.fn(),
      loadFile: vi.fn(() => Promise.resolve()),
      loadURL: vi.fn(() => Promise.resolve())
    }
  })
  createMainWindow(null, keybindings ? { getKeybindings: () => keybindings } : undefined)

  const setBrowserChromeFocused = (payload: unknown): void => {
    const listener = vi
      .mocked(ipcMain.on)
      .mock.calls.find(([channel]) => channel === 'ui:setBrowserChromeFocused')?.[1]
    // Why no existence assert: the Mod+L expectations below are what must fail without the channel.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the listener reads only event.sender.
    listener?.({ sender: webContents } as never, payload)
  }
  const pressMod = (code: string, key: string): ReturnType<typeof vi.fn> => {
    const preventDefault = vi.fn()
    windowHandlers['before-input-event'](
      { preventDefault },
      {
        type: 'keyDown',
        code,
        key,
        meta: isDarwin,
        control: !isDarwin,
        alt: false,
        shift: false
      }
    )
    return preventDefault
  }
  return { webContents, windowHandlers, setBrowserChromeFocused, pressMod }
}

describe('createMainWindow browser chrome focus', () => {
  beforeEach(() => {
    resetMainWindowMocks()
    resetExpectedTeardownStateForTest()
  })

  it('intercepts Mod+L for the right sidebar when browser chrome is not focused', () => {
    const { webContents, pressMod } = setUpWindow()
    const preventDefault = pressMod('KeyL', 'l')
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('ui:toggleRightSidebar')
  })

  it('leaves Mod+L to the renderer while browser chrome is focused', () => {
    const { webContents, setBrowserChromeFocused, pressMod } = setUpWindow()
    setBrowserChromeFocused(true)
    const preventDefault = pressMod('KeyL', 'l')
    expect(preventDefault).not.toHaveBeenCalled()
    expect(webContents.send).not.toHaveBeenCalledWith('ui:toggleRightSidebar')

    setBrowserChromeFocused(false)
    expect(pressMod('KeyL', 'l')).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('ui:toggleRightSidebar')
  })

  it('still intercepts window chords no browser action is bound to', () => {
    const { webContents, setBrowserChromeFocused, pressMod } = setUpWindow()
    setBrowserChromeFocused(true)
    expect(pressMod('KeyB', 'b')).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('ui:toggleLeftSidebar')
  })

  it('follows the effective browser binding, not a hardcoded chord', () => {
    const { webContents, setBrowserChromeFocused, pressMod } = setUpWindow({
      'browser.focusAddressBar': ['Mod+Shift+L']
    })
    setBrowserChromeFocused(true)
    expect(pressMod('KeyL', 'l')).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('ui:toggleRightSidebar')
  })

  it('treats a non-boolean payload as unfocused', () => {
    const { webContents, setBrowserChromeFocused, pressMod } = setUpWindow()
    setBrowserChromeFocused(true)
    setBrowserChromeFocused('yes')
    expect(pressMod('KeyL', 'l')).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('ui:toggleRightSidebar')
  })

  it('resets the flag when the renderer process is gone', () => {
    const { webContents, windowHandlers, setBrowserChromeFocused, pressMod } = setUpWindow()
    setBrowserChromeFocused(true)
    windowHandlers['render-process-gone']?.({}, { reason: 'clean-exit', exitCode: 0 })
    expect(pressMod('KeyL', 'l')).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('ui:toggleRightSidebar')
  })
})
