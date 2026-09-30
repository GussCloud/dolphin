import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () =>
  (await import('./createMainWindow-test-harness')).electronModuleMock()
)
vi.mock('@electron-toolkit/utils', async () =>
  (await import('./createMainWindow-test-harness')).electronToolkitUtilsMock()
)

import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import { installMainWindowFocusLifecycle } from './main-window-focus-lifecycle'
import { resetMainWindowMocks } from './createMainWindow-test-harness'

describe('installMainWindowFocusLifecycle', () => {
  let destroyed = false
  const mockWebContents = {
    id: 42,
    mainFrame: {},
    isDestroyed: vi.fn(() => destroyed),
    on: vi.fn(),
    send: vi.fn()
  }

  const mockMainWindow = {
    isDestroyed: vi.fn(() => destroyed),
    get webContents() {
      if (destroyed) {
        throw new TypeError('Object has been destroyed')
      }
      return mockWebContents
    }
  }

  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub implements the webContents/isDestroyed surface the lifecycle reads.
  const mainWindow = mockMainWindow as unknown as BrowserWindow

  const getListener = (channel: string) =>
    vi.mocked(ipcMain.on).mock.calls.find(([ch]) => ch === channel)?.[1]

  const sendFromRenderer = (channel: string, payload: unknown): void => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers only read event.sender, which the stub provides.
    const event = { sender: mockWebContents } as unknown as IpcMainEvent
    getListener(channel)?.(event, payload)
  }

  beforeEach(() => {
    resetMainWindowMocks()
    destroyed = false
    vi.clearAllMocks()
  })

  it('updates focus states when window is alive and sender is valid', () => {
    const lifecycle = installMainWindowFocusLifecycle({
      isWindowClosing: () => false,
      mainWindow,
      reloadMainWindow: vi.fn(),
      rendererWebContentsId: 42
    })

    expect(lifecycle.isTerminalInputFocused()).toBe(false)
    sendFromRenderer('ui:setTerminalInputFocused', true)
    expect(lifecycle.isTerminalInputFocused()).toBe(true)

    expect(lifecycle.isMarkdownEditorFocused()).toBe(false)
    sendFromRenderer('ui:setMarkdownEditorFocused', true)
    expect(lifecycle.isMarkdownEditorFocused()).toBe(true)

    expect(lifecycle.isFloatingPanelFocused()).toBe(false)
    sendFromRenderer('ui:setFloatingFocus', {
      terminalFocused: true,
      panelFocused: true
    })
    expect(lifecycle.isFloatingPanelFocused()).toBe(true)

    expect(lifecycle.isShortcutRecorderFocused()).toBe(false)
    sendFromRenderer('ui:setShortcutRecorderFocused', true)
    expect(lifecycle.isShortcutRecorderFocused()).toBe(true)

    lifecycle.dispose()
  })

  it('does not crash or throw "Object has been destroyed" when mainWindow is destroyed', () => {
    const lifecycle = installMainWindowFocusLifecycle({
      isWindowClosing: () => false,
      mainWindow,
      reloadMainWindow: vi.fn(),
      rendererWebContentsId: 42
    })

    // Simulate window destroyed
    destroyed = true

    expect(() => {
      sendFromRenderer('ui:setTerminalInputFocused', true)
      sendFromRenderer('ui:setMarkdownEditorFocused', true)
      sendFromRenderer('ui:setFloatingFocus', { terminalFocused: true })
      sendFromRenderer('ui:setShortcutRecorderFocused', true)
    }).not.toThrow()

    lifecycle.dispose()
  })

  it('removes ipcMain listeners upon dispose', () => {
    const lifecycle = installMainWindowFocusLifecycle({
      isWindowClosing: () => false,
      mainWindow,
      reloadMainWindow: vi.fn(),
      rendererWebContentsId: 42
    })

    lifecycle.dispose()

    expect(ipcMain.removeListener).toHaveBeenCalledWith(
      'ui:setTerminalInputFocused',
      expect.any(Function)
    )
    expect(ipcMain.removeListener).toHaveBeenCalledWith(
      'ui:setMarkdownEditorFocused',
      expect.any(Function)
    )
    expect(ipcMain.removeListener).toHaveBeenCalledWith('ui:setFloatingFocus', expect.any(Function))
    expect(ipcMain.removeListener).toHaveBeenCalledWith(
      'ui:setShortcutRecorderFocused',
      expect.any(Function)
    )
    expect(ipcMain.removeListener).toHaveBeenCalledWith(
      'rich-markdown:context-target',
      expect.any(Function)
    )
  })
})
