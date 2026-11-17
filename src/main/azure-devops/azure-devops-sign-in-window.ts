import { BrowserWindow, Menu, session } from 'electron'
import { join } from 'node:path'
import { translateMain } from '../i18n/main-i18n'
import { showWindowWithoutStealingFocus } from '../window/foreground-activation-policy'

// In-memory partition: nothing from the Microsoft sign-in outlives the window.
const SIGN_IN_PARTITION = 'azure-devops-sign-in'
const TITLE_PREFIX = 'Azure DevOps'

const signInWindows = new WeakSet<BrowserWindow>()

/** Third-party page: app broadcasts must skip it. */
export function isAzureDevOpsSignInWindow(window: BrowserWindow): boolean {
  return signInWindows.has(window)
}

export type AzureDevOpsSignInWindow = {
  /** Closes without reporting a user cancel. */
  close: () => void
}

export type OpenAzureDevOpsSignInWindowOptions = {
  url: string
  redirectPort: number | null
  parent: BrowserWindow | null
  onClosedByUser: () => void
}

/** Federated identity providers live on other https domains; http only for az's own loopback. */
export function isAllowedSignInNavigation(rawUrl: string, redirectPort: number | null): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol === 'https:') {
      return true
    }
    return (
      url.protocol === 'http:' &&
      redirectPort !== null &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port === String(redirectPort)
    )
  } catch {
    return false
  }
}

export function signInWindowTitle(rawUrl: string): string {
  try {
    return `${TITLE_PREFIX} — ${new URL(rawUrl).host}`
  } catch {
    return TITLE_PREFIX
  }
}

type SignInContextMenuParams = Pick<
  Electron.ContextMenuParams,
  'isEditable' | 'selectionText' | 'editFlags'
>

/** Native edit roles for the right-clicked field or selection; empty when none applies. */
export function buildSignInContextMenuTemplate(
  params: SignInContextMenuParams
): Electron.MenuItemConstructorOptions[] {
  const { editFlags } = params
  const copy: Electron.MenuItemConstructorOptions = {
    role: 'copy',
    label: translateMain('menu.copy', 'Copy'),
    enabled: editFlags.canCopy
  }
  const selectAll: Electron.MenuItemConstructorOptions = {
    role: 'selectAll',
    label: translateMain('menu.selectAll', 'Select All'),
    enabled: editFlags.canSelectAll
  }
  if (params.isEditable) {
    return [
      { role: 'cut', label: translateMain('menu.cut', 'Cut'), enabled: editFlags.canCut },
      copy,
      { role: 'paste', label: translateMain('menu.paste', 'Paste'), enabled: editFlags.canPaste },
      { type: 'separator' },
      selectAll
    ]
  }
  return params.selectionText ? [copy, selectAll] : []
}

// Why: the partition outlives each window, so its handlers must be installed once.
const lockedDownSessions = new WeakSet<Electron.Session>()

function lockDownSession(): Electron.Session {
  const signInSession = session.fromPartition(SIGN_IN_PARTITION)
  if (lockedDownSessions.has(signInSession)) {
    return signInSession
  }
  lockedDownSessions.add(signInSession)
  signInSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  signInSession.setPermissionCheckHandler(() => false)
  signInSession.on('will-download', (event) => event.preventDefault())
  return signInSession
}

async function clearSession(signInSession: Electron.Session): Promise<void> {
  try {
    await signInSession.clearStorageData()
    await signInSession.clearCache()
  } catch (error) {
    console.warn('[azure-devops] could not clear the sign-in window session', error)
  }
}

// Why code only: Electron's load error message embeds the URL, which carries the login_hint.
function describeLoadError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'unknown'
  }
  return 'code' in error && typeof error.code === 'string' ? error.code : error.name
}

export function openAzureDevOpsSignInWindow(
  options: OpenAzureDevOpsSignInWindowOptions
): AzureDevOpsSignInWindow {
  const signInSession = lockDownSession()
  const parent = options.parent && !options.parent.isDestroyed() ? options.parent : undefined
  const window = new BrowserWindow({
    width: 520,
    height: 720,
    show: false,
    parent,
    title: signInWindowTitle(options.url),
    autoHideMenuBar: true,
    webPreferences: {
      session: signInSession,
      // Why: keeps the page from raising the Windows Hello dialog on load.
      preload: join(__dirname, 'azure-devops-sign-in-preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  signInWindows.add(window)
  const contents = window.webContents
  const allowed = (url: string): boolean => isAllowedSignInNavigation(url, options.redirectPort)
  const blockDisallowed = (event: Electron.Event<{ url: string }>): void => {
    if (!allowed(event.url)) {
      event.preventDefault()
    }
  }
  contents.on('will-navigate', blockDisallowed)
  contents.on('will-redirect', blockDisallowed)
  contents.on('will-frame-navigate', (event) => {
    // Why: subframes may start at about:blank; the main frame is held to the allow-list.
    if (!event.isMainFrame && /^about:(blank|srcdoc)$/.test(event.url)) {
      return
    }
    blockDisallowed(event)
  })
  contents.setWindowOpenHandler(({ url }) => {
    // Why same window: some IdPs open their next step as a popup.
    if (url.startsWith('https:')) {
      void window.loadURL(url).catch(() => undefined)
    }
    return { action: 'deny' }
  })
  // Why: the real host in the title is the only origin indicator; the page must not spoof it.
  window.on('page-title-updated', (event) => event.preventDefault())
  const showOrigin = (): void => {
    if (!window.isDestroyed()) {
      window.setTitle(signInWindowTitle(contents.getURL()))
    }
  }
  // Why: the page is a plain web page, so Electron shows no edit menu unless one is built here.
  contents.on('context-menu', (_event, params) => {
    const template = buildSignInContextMenuTemplate(params)
    if (template.length > 0 && !window.isDestroyed()) {
      Menu.buildFromTemplate(template).popup({ window })
    }
  })
  contents.on('did-navigate', showOrigin)
  contents.on('did-navigate-in-page', showOrigin)
  window.once('ready-to-show', () => showWindowWithoutStealingFocus(window))
  // Why: a failed load may never paint, and a hidden window would leave az waiting unseen.
  contents.once('did-fail-load', () => showWindowWithoutStealingFocus(window))

  let closedByDolphin = false
  window.on('closed', () => {
    void clearSession(signInSession)
    if (!closedByDolphin) {
      options.onClosedByUser()
    }
  })
  void window.loadURL(options.url).catch((error: unknown) => {
    console.warn('[azure-devops] sign-in window failed to load', describeLoadError(error))
  })

  return {
    close: () => {
      closedByDolphin = true
      if (!window.isDestroyed()) {
        window.close()
      }
    }
  }
}
