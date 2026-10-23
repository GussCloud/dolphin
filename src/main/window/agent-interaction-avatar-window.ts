import { BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import {
  AGENT_INTERACTION_AVATAR_CHANNELS,
  type AgentInteractionAvatarFrame
} from '../../shared/agent-interaction-avatar-ipc'
import { isBackgroundLaunch, isWindowlessLaunch } from './foreground-activation-policy'
import { installPrivilegedWindowNavigationPolicy } from './privileged-window-navigation'

/** Round avatar plus room for its buzz, close badge and floating shadow in a transparent window. */
export const AGENT_INTERACTION_AVATAR_SIZE = { width: 120, height: 120 } as const
const SCREEN_EDGE_GAP = 8
const AVATAR_PARTITION = 'dolphin-agent-interaction-avatar'

let avatarWindow: BrowserWindow | null = null
let rendererReady = false
let pendingFrame: AgentInteractionAvatarFrame | null = null

function liveAvatarWindow(): BrowserWindow | null {
  return avatarWindow && !avatarWindow.isDestroyed() ? avatarWindow : null
}

export function isAgentInteractionAvatarRenderer(sender: WebContents): boolean {
  return liveAvatarWindow()?.webContents === sender
}

/** Right edge of the primary display's work area, vertically centered. */
export function resolveAgentInteractionAvatarBounds(workArea: Electron.Rectangle): Electron.Rectangle {
  const { width, height } = AGENT_INTERACTION_AVATAR_SIZE
  return {
    x: workArea.x + workArea.width - width - SCREEN_EDGE_GAP,
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height
  }
}

function placeAvatar(window: BrowserWindow): void {
  window.setBounds(resolveAgentInteractionAvatarBounds(screen.getPrimaryDisplay().workArea))
}

function loadAvatar(window: BrowserWindow): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/agent-avatar.html`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/agent-avatar.html'))
  }
}

function onDisplayMetricsChanged(): void {
  const window = liveAvatarWindow()
  if (window) {
    placeAvatar(window)
  }
}

function createAvatarWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...resolveAgentInteractionAvatarBounds(screen.getPrimaryDisplay().workArea),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Why: the avatar must never take focus from whatever the user is typing into.
    focusable: false,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    title: 'Dolphin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      partition: AVATAR_PARTITION,
      webviewTag: false,
      // Why: the window is usually hidden behind other apps; a throttled timer would delay the sound.
      backgroundThrottling: false
    }
  })
  installPrivilegedWindowNavigationPolicy(window.webContents)
  // Why: isolated sessions do not inherit the main session's deny-by-default permission policy.
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false)
  )
  window.webContents.session.setPermissionCheckHandler(() => false)
  // Why 'screen-saver': the plain level sits under full-screen apps and the Windows taskbar.
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Why: a reload remounts the renderer, which must ask for its frame again before receiving pushes.
  window.webContents.on('did-start-loading', () => {
    rendererReady = false
  })
  window.on('closed', () => {
    screen.removeListener('display-metrics-changed', onDisplayMetricsChanged)
    avatarWindow = null
    rendererReady = false
  })
  screen.on('display-metrics-changed', onDisplayMetricsChanged)
  loadAvatar(window)
  return window
}

function deliverFrame(window: BrowserWindow, frame: AgentInteractionAvatarFrame): void {
  window.webContents.send(AGENT_INTERACTION_AVATAR_CHANNELS.frame, frame)
  revealForFrame(window, frame)
}

function revealForFrame(window: BrowserWindow, frame: AgentInteractionAvatarFrame): void {
  if (!frame.view) {
    window.hide()
    return
  }
  // Why: background/test launches still load the renderer (CDP screenshots) but never present it.
  if (isWindowlessLaunch() || isBackgroundLaunch()) {
    return
  }
  placeAvatar(window)
  window.showInactive()
}

/** Shows (or hides, for an empty frame) the avatar, creating its window on first use. */
export function presentAgentInteractionAvatar(frame: AgentInteractionAvatarFrame): void {
  let window = liveAvatarWindow()
  if (!window) {
    if (!frame.view) {
      return
    }
    window = createAvatarWindow()
    avatarWindow = window
  }
  if (!rendererReady) {
    // Why latest-wins: an older frame queued before the renderer mounted is already superseded.
    pendingFrame = frame
    return
  }
  deliverFrame(window, frame)
}

/**
 * The renderer's first read after mounting. Pushes sent before it subscribed would be lost, so
 * the frame that created the window (with its sound) waits here instead.
 */
export function takeAgentInteractionAvatarInitialFrame(
  current: AgentInteractionAvatarFrame
): AgentInteractionAvatarFrame {
  const window = liveAvatarWindow()
  const frame = pendingFrame ?? current
  pendingFrame = null
  rendererReady = true
  if (window) {
    revealForFrame(window, frame)
  }
  return frame
}

/** Tears the window down with the main window so it cannot keep the app alive. */
export function closeAgentInteractionAvatar(): void {
  liveAvatarWindow()?.destroy()
  avatarWindow = null
  rendererReady = false
  pendingFrame = null
}
