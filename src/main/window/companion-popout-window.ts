import { app, BrowserWindow, nativeTheme, type WebContents } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { Store } from '../persistence'
import type { PersistedUIState } from '../../shared/persisted-ui-state-types'
import { isBackgroundLaunch, showWindowWithoutStealingFocus } from './foreground-activation-policy'
import { rectHasVisibleAreaOnAnyDisplay } from './window-bounds-validation'
import { installPrivilegedWindowNavigationPolicy } from './privileged-window-navigation'
import { isMacAppPasteInput } from './mac-app-paste-input'
import { stepUIZoomLevel, type UIZoomDirection } from '../../shared/ui-zoom-level'
import { nativeZoomCommandMatchesKeybindings } from '../../shared/window-shortcut-policy'
import {
  keybindingMatchesAction,
  type KeybindingActionId,
  type KeybindingInput,
  type KeybindingOverrides
} from '../../shared/keybindings'

const MIN_WIDTH = 480
const MIN_HEIGHT = 360
const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 720

type PopoutBounds = { x: number; y: number; width: number; height: number }
type PopoutBoundsKey = 'dashboardPopoutBounds' | 'designPopoutBounds'

export type CompanionPopoutSpec = {
  /** Prefix for console diagnostics, e.g. `dashboard-popout`. */
  logTag: string
  title: string
  /** In-memory session so Chromium's per-origin zoom stays window-local. */
  partition: string
  /** HTML entry emitted by electron-vite next to index.html. */
  htmlEntry: string
  boundsKey: PopoutBoundsKey
  /** Called on every open/close transition, after the singleton is updated. */
  onOpenChanged: (open: boolean) => void
}

export type CompanionPopoutOptions = { getKeybindings?: () => KeybindingOverrides | undefined }

export type CompanionPopoutWindow = {
  getWindow: () => BrowserWindow | null
  isRenderer: (sender: WebContents) => boolean
  zoomIfFocused: (direction: UIZoomDirection) => boolean
  createOrFocus: (store: Store | null, options?: CompanionPopoutOptions) => BrowserWindow
  close: () => void
}

const ZOOM_SHORTCUTS: readonly [KeybindingActionId, UIZoomDirection][] = [
  ['zoom.in', 'in'],
  ['zoom.out', 'out'],
  ['zoom.reset', 'reset']
]

function resolveZoomShortcut(
  input: KeybindingInput,
  keybindings: KeybindingOverrides | undefined
): UIZoomDirection | null {
  // Why: this runs on every keydown; avoid scanning unrelated window shortcuts in the typing path.
  for (const [actionId, direction] of ZOOM_SHORTCUTS) {
    if (
      keybindingMatchesAction(actionId, input, process.platform, keybindings, { context: 'app' })
    ) {
      return direction
    }
  }
  return null
}

function zoomWindow(window: BrowserWindow, direction: UIZoomDirection): void {
  const webContents = window.webContents
  webContents.setZoomLevel(stepUIZoomLevel(webContents.getZoomLevel(), direction))
}

/**
 * A singleton companion window (agent dashboard, Design) that the user can move
 * to another monitor. It shares the main window's preload/window.api but renders
 * its own React root from `htmlEntry`.
 */
export function createCompanionPopoutWindow(spec: CompanionPopoutSpec): CompanionPopoutWindow {
  // Why: singleton — a second open request focuses the existing window rather than spawning duplicates.
  let popoutWindow: BrowserWindow | null = null

  const getWindow = (): BrowserWindow | null =>
    popoutWindow && !popoutWindow.isDestroyed() && !popoutWindow.webContents.isDestroyed()
      ? popoutWindow
      : null

  const load = (window: BrowserWindow): void => {
    // Why: mirror loadMainWindow's dev/prod branch — the dev server serves the
    // extra HTML entry, prod loads the emitted file.
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${spec.htmlEntry}`)
    } else {
      void window.loadFile(join(__dirname, `../renderer/${spec.htmlEntry}`))
    }
  }

  const resolveRestoredBounds = (store: Store | null): PopoutBounds | null => {
    const ui: Pick<PersistedUIState, PopoutBoundsKey> | undefined = store?.getUI()
    const raw = ui?.[spec.boundsKey] ?? null
    if (
      raw &&
      raw.width >= MIN_WIDTH &&
      raw.height >= MIN_HEIGHT &&
      rectHasVisibleAreaOnAnyDisplay(raw, MIN_WIDTH / 2, MIN_HEIGHT / 2)
    ) {
      return raw
    }
    if (raw) {
      console.warn(`[${spec.logTag}] Discarding off-screen/near-min popout bounds:`, raw)
    }
    return null
  }

  const createOrFocus = (
    store: Store | null,
    options: CompanionPopoutOptions = {}
  ): BrowserWindow => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      if (popoutWindow.isMinimized()) {
        popoutWindow.restore()
      }
      if (!isBackgroundLaunch()) {
        popoutWindow.focus()
      }
      return popoutWindow
    }

    const savedBounds = resolveRestoredBounds(store)

    const window = new BrowserWindow({
      width: savedBounds?.width ?? DEFAULT_WIDTH,
      height: savedBounds?.height ?? DEFAULT_HEIGHT,
      ...(savedBounds ? { x: savedBounds.x, y: savedBounds.y } : {}),
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      title: spec.title,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1220' : '#ffffff',
      // Why: a standard native frame makes the pop-out movable, closable, and
      // minimizable on every platform without reimplementing the main window's
      // custom titlebar/drag-region/window-control chrome.
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        partition: spec.partition,
        // Why: pop-outs are plain DOM — no <webview> guests — so the guest-embedding
        // surface stays off and the window is not stamped with a browser-host id.
        webviewTag: false
      }
    })
    installPrivilegedWindowNavigationPolicy(window.webContents)
    // Why: isolated sessions do not inherit the main session's deny-by-default permission policy.
    window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
      callback(false)
    )
    window.webContents.session.setPermissionCheckHandler(() => false)
    popoutWindow = window
    spec.onOpenChanged(true)

    // Why: uiZoomLevel is the app-wide UI zoom; without this the pop-out always renders at 100%.
    window.webContents.on('dom-ready', () => {
      if (!window.isDestroyed()) {
        window.webContents.setZoomLevel(store?.getUI().uiZoomLevel ?? 0)
      }
    })
    // Follow app-zoom changes made while the pop-out is open. Compare against the
    // last followed value, not the live level, so a window-local zoom is not
    // snapped back until the app-wide level actually changes.
    let lastFollowedZoomLevel = store?.getUI().uiZoomLevel ?? 0
    const unsubscribeUIChanged = store?.onUIChanged((ui) => {
      const level = ui.uiZoomLevel ?? 0
      if (level === lastFollowedZoomLevel) {
        return
      }
      lastFollowedZoomLevel = level
      if (!window.isDestroyed()) {
        window.webContents.setZoomLevel(level)
      }
    })

    // Why: pop-outs have no renderer-side shortcut plumbing; resolve only paste
    // and the zoom chords here and let every other key fall through untouched.
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return
      }
      if (isMacAppPasteInput(input)) {
        // Why: kitty-mode xterm encodes Cmd+V as CSI u and consumes it, so the Edit menu accelerator never fires.
        event.preventDefault()
        window.webContents.send('ui:appMenuPaste')
        return
      }
      const direction = resolveZoomShortcut(input, options.getKeybindings?.())
      if (direction) {
        event.preventDefault()
        zoomWindow(window, direction)
      }
    })

    window.webContents.on('zoom-changed', (event, direction) => {
      // Why: Electron reports Ctrl/Cmd+wheel zoom outside the keyboard input path.
      if (
        (direction === 'in' || direction === 'out') &&
        nativeZoomCommandMatchesKeybindings(
          direction,
          process.platform,
          options.getKeybindings?.(),
          { context: 'app' }
        )
      ) {
        event.preventDefault()
        zoomWindow(window, direction)
      }
    })

    window.once('ready-to-show', () => {
      showWindowWithoutStealingFocus(window)
    })

    // Bounds persistence — debounced and frozen on close so teardown-time
    // resize/move events can't clobber the remembered size with near-minimum bounds.
    let boundsTimer: ReturnType<typeof setTimeout> | null = null
    let windowClosing = false
    const saveBounds = (): void => {
      if (boundsTimer) {
        clearTimeout(boundsTimer)
      }
      boundsTimer = setTimeout(() => {
        boundsTimer = null
        if (
          windowClosing ||
          window.isDestroyed() ||
          window.isMinimized() ||
          window.isFullScreen()
        ) {
          return
        }
        const bounds = window.getBounds()
        if (bounds.width < MIN_WIDTH || bounds.height < MIN_HEIGHT) {
          return
        }
        store?.updateUI(
          spec.boundsKey === 'designPopoutBounds'
            ? { designPopoutBounds: bounds }
            : { dashboardPopoutBounds: bounds }
        )
      }, 500)
    }
    window.on('resize', saveBounds)
    window.on('move', saveBounds)

    const freezeBounds = (): void => {
      windowClosing = true
      if (boundsTimer) {
        clearTimeout(boundsTimer)
        boundsTimer = null
      }
    }
    window.on('close', freezeBounds)
    app.on('before-quit', freezeBounds)

    window.on('closed', () => {
      app.removeListener('before-quit', freezeBounds)
      unsubscribeUIChanged?.()
      if (popoutWindow === window) {
        popoutWindow = null
      }
      spec.onOpenChanged(false)
    })

    load(window)
    return window
  }

  return {
    getWindow,
    isRenderer: (sender) => getWindow()?.webContents === sender,
    // Why: menu zoom must act on the window the user is looking at; false lets the caller try the next window.
    zoomIfFocused: (direction) => {
      const popout = getWindow()
      if (!popout || !popout.isFocused()) {
        return false
      }
      zoomWindow(popout, direction)
      return true
    },
    createOrFocus,
    // Why: called when the main window closes so the pop-out never orphans without its owner.
    close: () => {
      if (popoutWindow && !popoutWindow.isDestroyed()) {
        popoutWindow.close()
      }
      popoutWindow = null
    }
  }
}
