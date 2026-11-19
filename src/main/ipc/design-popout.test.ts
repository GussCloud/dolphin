import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  ipcMainMock,
  appMock,
  createPopoutMock,
  getPopoutMock,
  isPopoutRendererMock,
  isTrustedUIRendererMock,
  getTrustedWindowMock,
  safelyRevealMock
} = vi.hoisted(() => {
  const map = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handlers: map,
    ipcMainMock: {
      removeHandler: vi.fn(),
      handle: (channel: string, fn: (...args: unknown[]) => unknown) => map.set(channel, fn)
    },
    appMock: { focus: vi.fn() },
    createPopoutMock: vi.fn(
      (_store: unknown, _options?: { getKeybindings?: () => unknown }): unknown => undefined
    ),
    getPopoutMock: vi.fn((): unknown => null),
    isPopoutRendererMock: vi.fn((_sender: unknown) => false),
    isTrustedUIRendererMock: vi.fn((_sender: unknown) => false),
    getTrustedWindowMock: vi.fn((): unknown => null),
    safelyRevealMock: vi.fn()
  }
})

vi.mock('electron', () => ({ app: appMock, ipcMain: ipcMainMock }))
vi.mock('../window/design-popout-window', () => ({
  createOrFocusDesignPopout: createPopoutMock,
  getDesignPopoutWindow: getPopoutMock,
  isDesignPopoutRenderer: isPopoutRendererMock
}))
vi.mock('../window/focus-existing-window', () => ({ safelyRevealWindow: safelyRevealMock }))
vi.mock('./ui', () => ({
  getTrustedUIRendererWindow: getTrustedWindowMock,
  isTrustedUIRenderer: isTrustedUIRendererMock
}))

import { registerDesignPopoutHandlers } from './design-popout'

const mainSender = { id: 1, send: vi.fn() }
const popoutSender = { id: 2, send: vi.fn() }
const untrustedSender = { id: 3, send: vi.fn() }
const mainWindow = { isDestroyed: () => false, webContents: mainSender }

function invoke(channel: string, sender: unknown, args?: unknown): unknown {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`no handler for ${channel}`)
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: handlers read only event.sender; the fake senders stand in for WebContents.
  return handler({ sender } as never, args)
}

beforeEach(() => {
  handlers.clear()
  vi.stubEnv('DOLPHIN_BACKGROUND_LAUNCH', undefined)
  vi.stubEnv('DOLPHIN_E2E_HEADLESS', undefined)
  vi.stubEnv('DOLPHIN_E2E_HEADFUL', undefined)
  isTrustedUIRendererMock.mockImplementation((sender) => sender === mainSender)
  isPopoutRendererMock.mockImplementation((sender) => sender === popoutSender)
  getTrustedWindowMock.mockReturnValue(mainWindow)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers pass the store through untouched and read only getOverrides().
  registerDesignPopoutHandlers({} as never, { getOverrides: () => ({}) } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('designPopout:open', () => {
  it('opens the window only for the main renderer', () => {
    invoke('designPopout:open', popoutSender)
    invoke('designPopout:open', untrustedSender)
    expect(createPopoutMock).not.toHaveBeenCalled()

    invoke('designPopout:open', mainSender)
    expect(createPopoutMock).toHaveBeenCalledOnce()
    expect(createPopoutMock.mock.calls[0][1]?.getKeybindings?.()).toEqual({})
  })

  it('reports the open state to the main renderer only', () => {
    getPopoutMock.mockReturnValue({})
    expect(invoke('designPopout:getOpen', mainSender)).toBe(true)
    expect(invoke('designPopout:getOpen', untrustedSender)).toBe(false)
    getPopoutMock.mockReturnValue(null)
    expect(invoke('designPopout:getOpen', mainSender)).toBe(false)
  })
})

describe('pop-out hand-offs to the main window', () => {
  it('forwards a composer request from the pop-out and brings the main window forward', () => {
    const args = { designPrefill: { name: 'Checkout', request: 'Draw it', repoId: 'repo-1' } }
    invoke('designPopout:openComposer', popoutSender, args)

    expect(safelyRevealMock).toHaveBeenCalledWith(mainWindow)
    expect(mainSender.send).toHaveBeenCalledWith('ui:designPopoutOpenComposer', args)
    expect(appMock.focus).toHaveBeenCalledWith({ steal: true })
  })

  it('forwards a workspace reveal with its environment', () => {
    const args = { worktreeId: 'wt-1', runtimeEnvironmentId: 'env-1' }
    invoke('designPopout:revealWorktree', popoutSender, args)
    expect(mainSender.send).toHaveBeenCalledWith('ui:designPopoutRevealWorktree', args)
  })

  it('ignores requests from any other sender, including the main window itself', () => {
    invoke('designPopout:openComposer', mainSender, {})
    invoke('designPopout:openComposer', untrustedSender, {})
    invoke('designPopout:revealWorktree', untrustedSender, { worktreeId: 'wt-1' })
    expect(mainSender.send).not.toHaveBeenCalled()
    expect(safelyRevealMock).not.toHaveBeenCalled()
  })

  it('drops malformed payloads', () => {
    invoke('designPopout:openComposer', popoutSender, null)
    invoke('designPopout:openComposer', popoutSender, { designPrefill: { repoId: '' } })
    invoke('designPopout:openComposer', popoutSender, { designPrefill: { name: 7 } })
    invoke('designPopout:revealWorktree', popoutSender, { worktreeId: '' })
    invoke('designPopout:revealWorktree', popoutSender, {
      worktreeId: 'wt-1',
      runtimeEnvironmentId: 5
    })
    expect(mainSender.send).not.toHaveBeenCalled()
  })

  it('does not steal app focus in a background launch', () => {
    vi.stubEnv('DOLPHIN_BACKGROUND_LAUNCH', '1')
    invoke('designPopout:openComposer', popoutSender, {})
    expect(mainSender.send).toHaveBeenCalledWith('ui:designPopoutOpenComposer', {})
    expect(appMock.focus).not.toHaveBeenCalled()
  })

  it('does nothing when the main window is gone', () => {
    getTrustedWindowMock.mockReturnValue(null)
    invoke('designPopout:revealWorktree', popoutSender, { worktreeId: 'wt-1' })
    expect(safelyRevealMock).not.toHaveBeenCalled()
    expect(appMock.focus).not.toHaveBeenCalled()
  })
})
