// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserPageVetoesGuestDiscard } from './browser-guest-worktree-retention'
import {
  destroyPersistentWebview,
  isBrowserPageDevToolsOpen,
  registerPersistentWebview
} from './webview-registry'

const PAGE_ID = 'page-devtools'

function registerWebview(): HTMLElement {
  const element = document.createElement('webview')
  document.body.appendChild(element)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registration only adds listeners and reads style on the element.
  registerPersistentWebview(PAGE_ID, element as Electron.WebviewTag)
  return element
}

describe('DevTools discard veto', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { browser: { unregisterGuest: vi.fn(async () => true) } }
    })
  })
  afterEach(async () => {
    await destroyPersistentWebview(PAGE_ID)
  })

  it('vetoes discarding a page while its DevTools window is open', () => {
    const webview = registerWebview()
    expect(browserPageVetoesGuestDiscard(PAGE_ID)).toBe(false)

    webview.dispatchEvent(new Event('devtools-opened'))
    expect(isBrowserPageDevToolsOpen(PAGE_ID)).toBe(true)
    expect(browserPageVetoesGuestDiscard(PAGE_ID)).toBe(true)

    webview.dispatchEvent(new Event('devtools-closed'))
    expect(browserPageVetoesGuestDiscard(PAGE_ID)).toBe(false)
  })

  it('forgets the DevTools state when the guest is destroyed', async () => {
    const webview = registerWebview()
    webview.dispatchEvent(new Event('devtools-opened'))
    await destroyPersistentWebview(PAGE_ID)
    expect(isBrowserPageDevToolsOpen(PAGE_ID)).toBe(false)
  })
})
