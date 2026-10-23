import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentInteractionAvatarFrame } from '../../shared/agent-interaction-avatar-ipc'

const { instances, BrowserWindowMock, screenMock } = vi.hoisted(() => {
  const created: FakeWindow[] = []

  class FakeWindow {
    options: Electron.BrowserWindowConstructorOptions
    destroyed = false
    private handlers: Record<string, (() => void)[]> = {}
    webContents = {
      send: vi.fn(),
      on: vi.fn(),
      session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() }
    }
    show = vi.fn()
    showInactive = vi.fn()
    focus = vi.fn()
    hide = vi.fn()
    setBounds = vi.fn()
    setAlwaysOnTop = vi.fn()
    setVisibleOnAllWorkspaces = vi.fn()
    loadURL = vi.fn()
    loadFile = vi.fn()
    destroy = vi.fn(() => {
      this.destroyed = true
      for (const cb of this.handlers.closed ?? []) {
        cb()
      }
    })

    constructor(options: Electron.BrowserWindowConstructorOptions) {
      this.options = options
      created.push(this)
    }

    on(event: string, cb: () => void): this {
      ;(this.handlers[event] ||= []).push(cb)
      return this
    }

    isDestroyed(): boolean {
      return this.destroyed
    }
  }

  return {
    instances: created,
    BrowserWindowMock: FakeWindow,
    screenMock: {
      getPrimaryDisplay: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } })),
      on: vi.fn(),
      removeListener: vi.fn()
    }
  }
})

vi.mock('electron', () => ({ BrowserWindow: BrowserWindowMock, screen: screenMock }))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('./privileged-window-navigation', () => ({
  installPrivilegedWindowNavigationPolicy: vi.fn()
}))

const cueFrame: AgentInteractionAvatarFrame = {
  view: {
    cue: { kind: 'task-done', paneKey: 'tab:leaf', createdAt: 1 },
    pendingCount: 0
  },
  sound: { kind: 'task-done', volume: 80 }
}

async function loadModule() {
  return import('./agent-interaction-avatar-window')
}

describe('agent interaction avatar window', () => {
  beforeEach(() => {
    vi.resetModules()
    instances.length = 0
    vi.unstubAllEnvs()
    vi.stubEnv('DOLPHIN_BACKGROUND_LAUNCH', '')
    vi.stubEnv('DOLPHIN_E2E_HEADLESS', '')
    vi.stubEnv('DOLPHIN_E2E_HEADFUL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('places the avatar on the right edge, vertically centered in the work area', async () => {
    const { resolveAgentInteractionAvatarBounds, AGENT_INTERACTION_AVATAR_SIZE } =
      await loadModule()
    const bounds = resolveAgentInteractionAvatarBounds({ x: 0, y: 40, width: 1920, height: 1000 })
    expect(bounds.x + bounds.width).toBe(1912)
    expect(bounds.y + bounds.height / 2).toBe(540)
    expect(bounds.width).toBe(AGENT_INTERACTION_AVATAR_SIZE.width)
  })

  it('creates a clickable, always-on-top window lazily and never for an empty frame', async () => {
    const avatar = await loadModule()
    avatar.presentAgentInteractionAvatar({ view: null })
    expect(instances).toHaveLength(0)
    avatar.presentAgentInteractionAvatar(cueFrame)
    expect(instances).toHaveLength(1)
    expect(instances[0].options).toMatchObject({
      show: false,
      frame: false,
      transparent: true,
      skipTaskbar: true,
      alwaysOnTop: true
    })
    // Why: a non-focusable window never receives real clicks on Windows.
    expect(instances[0].options.focusable).not.toBe(false)
    expect(instances[0].setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver')
  })

  it('hands the first frame, sound included, to the renderer once it mounts', async () => {
    const avatar = await loadModule()
    avatar.presentAgentInteractionAvatar(cueFrame)
    const window = instances[0]
    expect(window.webContents.send).not.toHaveBeenCalled()
    expect(avatar.takeAgentInteractionAvatarInitialFrame({ view: null })).toEqual(cueFrame)
    expect(window.showInactive).toHaveBeenCalledTimes(1)
    expect(window.show).not.toHaveBeenCalled()
    expect(window.focus).not.toHaveBeenCalled()

    avatar.presentAgentInteractionAvatar({ view: null })
    expect(window.webContents.send).toHaveBeenCalledWith('agentInteractionAvatar:frame', {
      view: null
    })
    expect(window.hide).toHaveBeenCalledTimes(1)
  })

  it('loads but never presents the window in a background launch', async () => {
    vi.stubEnv('DOLPHIN_BACKGROUND_LAUNCH', '1')
    const avatar = await loadModule()
    avatar.presentAgentInteractionAvatar(cueFrame)
    avatar.takeAgentInteractionAvatarInitialFrame({ view: null })
    expect(instances[0].loadFile).toHaveBeenCalledTimes(1)
    expect(instances[0].showInactive).not.toHaveBeenCalled()
    expect(instances[0].show).not.toHaveBeenCalled()
  })

  it('trusts only its own renderer and is torn down with the main window', async () => {
    const avatar = await loadModule()
    avatar.presentAgentInteractionAvatar(cueFrame)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake only needs identity equality with the window it belongs to.
    const sender = instances[0].webContents as unknown as Electron.WebContents
    expect(avatar.isAgentInteractionAvatarRenderer(sender)).toBe(true)
    avatar.closeAgentInteractionAvatar()
    expect(instances[0].destroy).toHaveBeenCalled()
    expect(avatar.isAgentInteractionAvatarRenderer(sender)).toBe(false)
  })
})
