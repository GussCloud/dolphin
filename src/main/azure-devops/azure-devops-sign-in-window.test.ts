import { describe, expect, it, vi } from 'vitest'
import {
  isAllowedSignInNavigation,
  openAzureDevOpsSignInWindow,
  signInWindowTitle
} from './azure-devops-sign-in-window'

const fakeSession = vi.hoisted(() => ({
  setPermissionRequestHandler: vi.fn(),
  setPermissionCheckHandler: vi.fn(),
  on: vi.fn(),
  clearStorageData: vi.fn(),
  clearCache: vi.fn()
}))

vi.mock('electron', () => {
  class FakeBrowserWindow {
    static created: unknown[] = []
    constructor(options: unknown) {
      FakeBrowserWindow.created.push(options)
    }
    webContents = { on: vi.fn(), once: vi.fn(), setWindowOpenHandler: vi.fn(), getURL: vi.fn() }
    on = vi.fn()
    once = vi.fn()
    isDestroyed = (): boolean => false
    close = vi.fn()
    setTitle = vi.fn()
    loadURL = vi.fn(() => Promise.resolve())
  }
  return { BrowserWindow: FakeBrowserWindow, session: { fromPartition: () => fakeSession } }
})
const { BrowserWindow: CreatedWindows } = await import('electron')
vi.mock('../window/foreground-activation-policy', () => ({
  showWindowWithoutStealingFocus: vi.fn()
}))

describe('openAzureDevOpsSignInWindow', () => {
  it('locks the shared partition down once across sign-ins', () => {
    const options = {
      url: 'https://login.microsoftonline.com/x',
      redirectPort: 50123,
      parent: null,
      onClosedByUser: vi.fn()
    }
    openAzureDevOpsSignInWindow(options).close()
    openAzureDevOpsSignInWindow(options).close()
    expect(fakeSession.on).toHaveBeenCalledOnce()
    expect(fakeSession.on).toHaveBeenCalledWith('will-download', expect.any(Function))
    expect(fakeSession.setPermissionRequestHandler).toHaveBeenCalledOnce()
  })

  it('loads the sandboxed WebAuthn preload in the sign-in window', () => {
    openAzureDevOpsSignInWindow({
      url: 'https://login.microsoftonline.com/x',
      redirectPort: null,
      parent: null,
      onClosedByUser: vi.fn()
    }).close()
    const created: unknown = Reflect.get(CreatedWindows, 'created')
    const last = Array.isArray(created) ? created.at(-1) : null
    expect(last).toMatchObject({
      webPreferences: {
        preload: expect.stringMatching(/azure-devops-sign-in-preload\.js$/),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
  })
})

describe('isAllowedSignInNavigation', () => {
  it('allows https, including federated identity providers', () => {
    expect(isAllowedSignInNavigation('https://login.microsoftonline.com/x', 50123)).toBe(true)
    expect(isAllowedSignInNavigation('https://adfs.contoso.com/adfs/ls', null)).toBe(true)
  })

  it('allows http only on the captured loopback port', () => {
    expect(isAllowedSignInNavigation('http://localhost:50123/?code=x', 50123)).toBe(true)
    expect(isAllowedSignInNavigation('http://127.0.0.1:50123/', 50123)).toBe(true)
    expect(isAllowedSignInNavigation('http://localhost:8080/', 50123)).toBe(false)
    expect(isAllowedSignInNavigation('http://localhost:50123/', null)).toBe(false)
    expect(isAllowedSignInNavigation('http://example.com:50123/', 50123)).toBe(false)
  })

  it('blocks other schemes', () => {
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x', 'x']) {
      expect(isAllowedSignInNavigation(url, 50123)).toBe(false)
    }
  })
})

describe('signInWindowTitle', () => {
  it('shows only the real host, never the path or query', () => {
    expect(signInWindowTitle('https://login.microsoftonline.com/a?code=secret')).toBe(
      'Azure DevOps — login.microsoftonline.com'
    )
    expect(signInWindowTitle('bogus')).toBe('Azure DevOps')
  })
})
