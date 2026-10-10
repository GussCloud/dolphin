import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installElectronProxyRequestGuard,
  PROXIED_REQUEST_URL_PATTERNS
} from './electron-proxy-request-guard'
import {
  applyProxySettingsToSession,
  resetSessionProxyApplicationForTests,
  retireProxySessionApplication
} from './proxy-settings'

function createSession() {
  type Listener = (details: unknown, callback: (result: { cancel?: boolean }) => void) => void
  let listener: Listener | null = null
  let urlSchemes: string[] = []
  const proxySession = {
    resolveProxy: vi.fn(async () => 'DIRECT'),
    setProxy: vi.fn(async () => {}),
    closeAllConnections: vi.fn(async () => {}),
    webRequest: {
      onBeforeRequest: vi.fn((filter: { urls: string[] }, next: Listener | null) => {
        urlSchemes = filter.urls.map((pattern) => pattern.split('://')[0] ?? '')
        listener = next
      })
    }
  }
  return {
    proxySession,
    request: (callback: (result: { cancel?: boolean }) => void) => listener?.({}, callback),
    /** Mirrors Electron: a request outside the filter never reaches the listener and proceeds. */
    requestUrl: (url: string, callback: (result: { cancel?: boolean }) => void) => {
      if (!urlSchemes.includes(new URL(url).protocol.slice(0, -1))) {
        callback({})
        return
      }
      listener?.({ url }, callback)
    }
  }
}

describe('default-session proxy request guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only intercepts schemes a proxy can route, never local app resources', () => {
    const { proxySession } = createSession()
    installElectronProxyRequestGuard(proxySession as never)

    const [filter] = proxySession.webRequest.onBeforeRequest.mock.calls[0] ?? []
    expect(filter).toEqual({ urls: PROXIED_REQUEST_URL_PATTERNS })
    expect(PROXIED_REQUEST_URL_PATTERNS.map((pattern) => pattern.split(':')[0])).toEqual([
      'http',
      'https',
      'ws',
      'wss'
    ])
  })

  it('holds renderer requests until a delayed proxy transition settles', async () => {
    const { proxySession, request } = createSession()
    let finishWrite: (() => void) | undefined
    proxySession.setProxy.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishWrite = resolve))
    )
    resetSessionProxyApplicationForTests(proxySession)
    installElectronProxyRequestGuard(proxySession as never)

    const applying = applyProxySettingsToSession(
      proxySession,
      { httpProxyUrl: 'http://proxy.example:8080' },
      { env: {} }
    )
    const callback = vi.fn()
    request(callback)
    expect(callback).not.toHaveBeenCalled()

    await vi.waitFor(() => expect(proxySession.setProxy).toHaveBeenCalledOnce())
    finishWrite?.()
    await applying
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({}))
  })

  it('keeps renderer requests blocked across a transient retry', async () => {
    const { proxySession, request } = createSession()
    let finishRetry: (() => void) | undefined
    proxySession.setProxy
      .mockRejectedValueOnce(new Error('transient proxy failure'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishRetry = resolve)))
    resetSessionProxyApplicationForTests(proxySession)
    installElectronProxyRequestGuard(proxySession as never)

    const applying = applyProxySettingsToSession(
      proxySession,
      { httpProxyUrl: 'http://proxy.example:8080' },
      { env: {} }
    )
    const callback = vi.fn()
    request(callback)

    await vi.waitFor(() => expect(proxySession.setProxy).toHaveBeenCalledTimes(2))
    expect(callback).not.toHaveBeenCalled()
    finishRetry?.()
    await applying
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({}))
  })

  it('recovers after two transient failures without another settings transition', async () => {
    const { proxySession, request } = createSession()
    proxySession.setProxy
      .mockRejectedValueOnce(new Error('first transient proxy failure'))
      .mockRejectedValueOnce(new Error('second transient proxy failure'))
    resetSessionProxyApplicationForTests(proxySession)
    installElectronProxyRequestGuard(proxySession as never)

    const applying = applyProxySettingsToSession(
      proxySession,
      { httpProxyUrl: 'http://proxy.example:8080' },
      { env: {} }
    )
    const callback = vi.fn()
    request(callback)

    await vi.waitFor(() => expect(proxySession.setProxy).toHaveBeenCalledTimes(2))
    expect(callback).not.toHaveBeenCalled()
    await applying
    expect(proxySession.setProxy).toHaveBeenCalledTimes(3)
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({}))
  })

  it('cancels renderer requests after proxy application fails', async () => {
    const { proxySession, request } = createSession()
    proxySession.setProxy.mockRejectedValue(new Error('proxy apply failed'))
    resetSessionProxyApplicationForTests(proxySession)
    installElectronProxyRequestGuard(proxySession as never)

    await expect(
      applyProxySettingsToSession(
        proxySession,
        { httpProxyUrl: 'http://proxy.example:8080' },
        { env: {} }
      )
    ).rejects.toThrow('proxy apply failed')
    const callback = vi.fn()
    request(callback)

    expect(callback).toHaveBeenCalledWith({ cancel: true })
  })

  it("still loads the app's own file:// UI after proxy application fails", async () => {
    const { proxySession, requestUrl } = createSession()
    proxySession.setProxy.mockRejectedValue(new Error('proxy apply failed'))
    resetSessionProxyApplicationForTests(proxySession)
    installElectronProxyRequestGuard(proxySession as never)

    await expect(
      applyProxySettingsToSession(
        proxySession,
        { httpProxyUrl: 'http://proxy.example:8080' },
        { env: {} }
      )
    ).rejects.toThrow('proxy apply failed')
    const appResource = vi.fn()
    const networkRequest = vi.fn()
    requestUrl('file:///C:/Program%20Files/Dolphin/out/renderer/index.html', appResource)
    requestUrl('wss://relay.example/socket', networkRequest)

    expect(appResource).toHaveBeenCalledWith({})
    expect(networkRequest).toHaveBeenCalledWith({ cancel: true })
  })

  it('cancels session requests after permanent retirement without a WebContents', async () => {
    const { proxySession, request } = createSession()
    resetSessionProxyApplicationForTests(proxySession)
    installElectronProxyRequestGuard(proxySession as never)
    await applyProxySettingsToSession(
      proxySession,
      { httpProxyUrl: 'http://proxy.example:8080' },
      { env: {} }
    )

    await retireProxySessionApplication(proxySession)
    const callback = vi.fn()
    request(callback)

    expect(callback).toHaveBeenCalledWith({ cancel: true })
  })
})
