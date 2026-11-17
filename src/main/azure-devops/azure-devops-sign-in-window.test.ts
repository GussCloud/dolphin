import { describe, expect, it, vi } from 'vitest'
import {
  buildSignInContextMenuTemplate,
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
const createdWindowOptions = vi.hoisted((): unknown[] => [])
const contextMenuHandlers = vi.hoisted((): ((event: unknown, params: unknown) => void)[] => [])
const menuPopup = vi.hoisted(() => vi.fn())
const loadUrlResult = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('electron', () => {
  class FakeBrowserWindow {
    constructor(options: unknown) {
      createdWindowOptions.push(options)
    }
    webContents = {
      on: vi.fn((event: string, handler: (event: unknown, params: unknown) => void) => {
        if (event === 'context-menu') {
          contextMenuHandlers.push(handler)
        }
      }),
      once: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      getURL: vi.fn()
    }
    on = vi.fn()
    once = vi.fn()
    isDestroyed = (): boolean => false
    close = vi.fn()
    setTitle = vi.fn()
    loadURL = vi.fn((_url: string) => loadUrlResult())
  }
  return {
    BrowserWindow: FakeBrowserWindow,
    Menu: { buildFromTemplate: () => ({ popup: menuPopup }) },
    app: { getLocale: () => 'en-US' },
    session: { fromPartition: () => fakeSession }
  }
})
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
    expect(createdWindowOptions.at(-1)).toMatchObject({
      webPreferences: {
        preload: expect.stringMatching(/azure-devops-sign-in-preload\.js$/),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
  })
})

const EDIT_FLAGS = {
  canUndo: false,
  canRedo: false,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: false
}

describe('sign-in window load failure', () => {
  it('logs only the error code, never the hinted URL', async () => {
    const hintedUrl = 'https://login.microsoftonline.com/x?login_hint=ana%40contoso.com'
    const failure = Object.assign(new Error(`ERR_ABORTED (-3) loading '${hintedUrl}'`), {
      code: 'ERR_ABORTED'
    })
    loadUrlResult.mockReturnValueOnce(Promise.reject(failure))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    openAzureDevOpsSignInWindow({
      url: hintedUrl,
      redirectPort: null,
      parent: null,
      onClosedByUser: vi.fn()
    }).close()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(warn).toHaveBeenCalledWith('[azure-devops] sign-in window failed to load', 'ERR_ABORTED')
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/contoso|login_hint/)
    warn.mockRestore()
  })
})

describe('buildSignInContextMenuTemplate', () => {
  it('offers cut, copy, paste and select all with native roles in an editable field', () => {
    const template = buildSignInContextMenuTemplate({
      isEditable: true,
      selectionText: '',
      editFlags: { ...EDIT_FLAGS, canCut: false }
    })
    expect(template.map((item) => item.role ?? item.type)).toEqual([
      'cut',
      'copy',
      'paste',
      'separator',
      'selectAll'
    ])
    expect(template[0]?.enabled).toBe(false)
    expect(template[2]?.enabled).toBe(true)
  })

  it('offers copy for selected page text and nothing on bare page', () => {
    expect(
      buildSignInContextMenuTemplate({
        isEditable: false,
        selectionText: 'user@contoso.com',
        editFlags: EDIT_FLAGS
      }).map((item) => item.role)
    ).toEqual(['copy', 'selectAll'])
    expect(
      buildSignInContextMenuTemplate({
        isEditable: false,
        selectionText: '',
        editFlags: EDIT_FLAGS
      })
    ).toEqual([])
  })

  it('pops the menu up from the sign-in window on right-click', () => {
    openAzureDevOpsSignInWindow({
      url: 'https://login.microsoftonline.com/x',
      redirectPort: null,
      parent: null,
      onClosedByUser: vi.fn()
    })
    contextMenuHandlers.at(-1)?.({}, { isEditable: true, selectionText: '', editFlags: EDIT_FLAGS })
    expect(menuPopup).toHaveBeenCalledOnce()
    contextMenuHandlers.at(-1)?.(
      {},
      { isEditable: false, selectionText: '', editFlags: EDIT_FLAGS }
    )
    expect(menuPopup).toHaveBeenCalledOnce()
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
