import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, isTrustedUIRendererMock, installMock, cancelMock } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => unknown>(),
  isTrustedUIRendererMock: vi.fn(),
  installMock: vi.fn(),
  cancelMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: vi.fn(),
    handle: (channel: string, handler: (event: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))
vi.mock('./ui', () => ({ isTrustedUIRenderer: isTrustedUIRendererMock }))
vi.mock('../pwsh-install', () => ({
  installPwshWithWinget: installMock,
  cancelPwshInstall: cancelMock
}))

import { registerPwshInstallHandlers } from './pwsh-install'

const event = { sender: {} }

describe('registerPwshInstallHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    isTrustedUIRendererMock.mockReset()
    installMock.mockReset()
    cancelMock.mockReset()
    registerPwshInstallHandlers()
  })

  it('installs only for the trusted UI renderer', async () => {
    installMock.mockResolvedValue({ status: 'installed', pwshAvailable: true })
    isTrustedUIRendererMock.mockReturnValue(false)
    await expect(handlers.get('pwsh:install')?.(event)).resolves.toEqual({ status: 'unsupported' })
    expect(installMock).not.toHaveBeenCalled()

    isTrustedUIRendererMock.mockReturnValue(true)
    await expect(handlers.get('pwsh:install')?.(event)).resolves.toEqual({
      status: 'installed',
      pwshAvailable: true
    })
  })

  it('cancels only for the trusted UI renderer', () => {
    isTrustedUIRendererMock.mockReturnValue(false)
    handlers.get('pwsh:cancelInstall')?.(event)
    expect(cancelMock).not.toHaveBeenCalled()

    isTrustedUIRendererMock.mockReturnValue(true)
    handlers.get('pwsh:cancelInstall')?.(event)
    expect(cancelMock).toHaveBeenCalledTimes(1)
  })
})
