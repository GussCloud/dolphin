// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AppCommandHandlers from './app-command-handlers'

const toggleRightSidebar = vi.fn()

vi.mock('./app-command-handlers', async (importOriginal) => ({
  ...(await importOriginal<typeof AppCommandHandlers>()),
  useAppShortcutActions: () => ({
    toggleSidebar: vi.fn(),
    toggleRightSidebar,
    setRightSidebarOpen: vi.fn(),
    setRightSidebarTab: vi.fn(),
    showRightSidebarFiles: vi.fn(),
    showRightSidebarSearch: vi.fn(),
    openDiffNotesSendMenuForActiveWorktree: vi.fn(() => false)
  })
}))
vi.mock('@/store/plugin-panels', () => ({ usePluginCommands: () => [] }))

import { useGlobalKeybindings } from './use-global-keybindings'
import { shortcutPlatform } from './app-window-chrome'

const setBrowserChromeFocused = vi.fn()

function renderGlobalKeybindings(): () => void {
  const args = {
    layout: {
      activeView: 'terminal',
      activeWorktreeId: 'wt-1',
      creationLayoutActive: false,
      workspaceChromeActive: true
    },
    floatingWorkspace: {
      enabled: false,
      open: false,
      visibleTabCount: 0,
      openMaximized: vi.fn(),
      setOpenWithFocus: vi.fn()
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the fields stubbed above.
  const view = renderHook(() => useGlobalKeybindings(args as never))
  return view.unmount
}

function pressModL(target: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'l',
    code: 'KeyL',
    metaKey: shortcutPlatform === 'darwin',
    ctrlKey: shortcutPlatform !== 'darwin',
    bubbles: true,
    cancelable: true
  })
  target.dispatchEvent(event)
  return event
}

function mountChromeButton(): HTMLButtonElement {
  const overlay = document.createElement('div')
  overlay.setAttribute('data-browser-overlay-tab-id', 'browser-1')
  const button = document.createElement('button')
  overlay.appendChild(button)
  document.body.appendChild(overlay)
  return button
}

describe('useGlobalKeybindings browser chrome precedence', () => {
  let unmount: (() => void) | null = null

  beforeEach(() => {
    toggleRightSidebar.mockClear()
    setBrowserChromeFocused.mockClear()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the ui methods this hook calls are read.
    window.api = { ui: { setBrowserChromeFocused } } as never
    unmount = renderGlobalKeybindings()
  })

  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
  })

  it('leaves Mod+L to the browser pane when pressed in its chrome', () => {
    const button = mountChromeButton()
    const event = pressModL(button)
    expect(toggleRightSidebar).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('still toggles the right sidebar for Mod+L outside browser chrome', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const event = pressModL(outside)
    expect(toggleRightSidebar).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('mirrors browser chrome focus to main', () => {
    const button = mountChromeButton()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    button.focus()
    expect(setBrowserChromeFocused).toHaveBeenLastCalledWith(true)
    outside.focus()
    expect(setBrowserChromeFocused).toHaveBeenLastCalledWith(false)
  })
})
