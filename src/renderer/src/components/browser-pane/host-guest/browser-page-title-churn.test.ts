import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserPageWebviewNavigationHandlers } from './browser-page-webview-navigation-handlers'
import {
  BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS,
  type BrowserGuestVisibility
} from './browser-guest-churn-throttle'
import type { BrowserTabPageState } from '../describe-page/browser-page-types'

const TAB_ID = 'tab-1'

function createHarness(visibility?: BrowserGuestVisibility) {
  const guest = { url: 'https://example.com/', title: 'Example' }
  const updates: BrowserTabPageState[] = []
  const history = vi.fn()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers only call these four getters.
  const webview = {
    getURL: () => guest.url,
    getTitle: () => guest.title,
    canGoBack: () => false,
    canGoForward: () => false,
    src: guest.url
  } as unknown as Electron.WebviewTag
  const ref = <T>(value: T) => ({ current: value })
  const handlers = createBrowserPageWebviewNavigationHandlers({
    webview,
    browserTabId: TAB_ID,
    browserTabUrl: guest.url,
    recoveryNavigationValidationRef: ref(null),
    activeLoadFailureRef: ref(null),
    lastKnownWebviewUrlRef: ref<string | null>(guest.url),
    addressBarInputRef: ref(null),
    onSetUrlRef: ref(vi.fn()),
    onUpdatePageStateRef: ref((_tabId: string, next: BrowserTabPageState) => {
      updates.push(next)
    }),
    addBrowserHistoryEntryRef: ref(history),
    faviconUrlRef: ref<string | null>(null),
    setAddressBarValue: vi.fn(),
    annotationViewportBridgeTokenRef: ref('token'),
    setBrowserOverlayViewport: vi.fn(),
    guestVisibility: visibility
  })
  const titleUpdates = (): BrowserTabPageState[] =>
    updates.filter((update) => update.title !== undefined && update.canGoBack === undefined)
  return { guest, updates, titleUpdates, history, handlers }
}

describe('page title churn', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { activeElement: null })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes a ticking title at most once per interval and counts a single history visit', () => {
    const harness = createHarness()
    for (let tick = 0; tick < 10; tick++) {
      harness.guest.title = `Clock ${tick}`
      harness.handlers.handleTitleUpdate()
      vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS / 4)
    }
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS)

    expect(harness.titleUpdates().length).toBeLessThanOrEqual(4)
    expect(harness.titleUpdates().at(-1)).toEqual({ title: 'Clock 9' })
    const bumps = harness.history.mock.calls.map((call) => call[3]?.bump)
    expect(bumps[0]).toBe(true)
    expect(bumps.slice(1).every((bump) => bump === false)).toBe(true)
  })

  it('skips a repeated identical title', () => {
    const harness = createHarness()
    harness.handlers.handleTitleUpdate()
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS * 2)
    harness.handlers.handleTitleUpdate()
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS * 2)

    expect(harness.titleUpdates()).toEqual([{ title: 'Example' }])
    expect(harness.history).toHaveBeenCalledTimes(1)
  })

  it('counts a new visit after a committed navigation, even to the same url', () => {
    const harness = createHarness()
    harness.handlers.handleTitleUpdate()
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS * 2)
    harness.handlers.handleFullDidNavigate({ url: harness.guest.url, isMainFrame: true })
    harness.handlers.handleTitleUpdate()

    expect(harness.history.mock.calls.map((call) => call[3]?.bump)).toEqual([true, true])
  })

  it('applies the guest title current at flush time, not the one pending before a navigation', () => {
    const harness = createHarness()
    harness.handlers.handleTitleUpdate()
    harness.guest.title = 'Old page tick'
    harness.handlers.handleTitleUpdate()
    harness.guest.url = 'https://example.org/next'
    harness.guest.title = 'Next page'
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS)

    expect(harness.titleUpdates().at(-1)).toEqual({ title: 'Next page' })
    expect(harness.history).toHaveBeenLastCalledWith(
      'https://example.org/next',
      'Next page',
      null,
      {
        bump: true
      }
    )
  })

  it('defers a hidden guest until it becomes visible, then flushes on dispose too', () => {
    let visible = false
    const onVisible: { current: (() => void) | null } = { current: null }
    const harness = createHarness({
      isVisible: () => visible,
      onBecameVisible: (listener) => {
        onVisible.current = listener
        return () => {
          onVisible.current = null
        }
      }
    })
    harness.handlers.handleTitleUpdate()
    harness.guest.title = 'Hidden tick'
    harness.handlers.handleTitleUpdate()
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS * 5)
    expect(harness.titleUpdates()).toEqual([{ title: 'Example' }])

    visible = true
    onVisible.current?.()
    expect(harness.titleUpdates().at(-1)).toEqual({ title: 'Hidden tick' })

    harness.guest.title = 'Final'
    harness.handlers.handleTitleUpdate()
    harness.guest.title = 'Final 2'
    harness.handlers.handleTitleUpdate()
    harness.handlers.disposeMetadataThrottles()
    expect(harness.titleUpdates().at(-1)).toEqual({ title: 'Final 2' })
  })

  it('coalesces favicon churn but still drops the icon at once on an origin change', () => {
    const harness = createHarness()
    harness.handlers.handleFaviconUpdate({ favicons: ['https://example.com/a.png'] })
    harness.handlers.handleFaviconUpdate({ favicons: ['https://example.com/b.png'] })
    const leaveOrigin = {
      isMainFrame: true,
      isInPlace: false,
      url: 'https://other.example/'
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only these three fields.
    harness.handlers.handleDidStartNavigation(leaveOrigin as Electron.DidStartNavigationEvent)
    vi.advanceTimersByTime(BROWSER_GUEST_VISIBLE_CHURN_INTERVAL_MS * 2)

    const faviconUpdates = harness.updates.filter((update) => 'faviconUrl' in update)
    expect(faviconUpdates).toEqual([
      { faviconUrl: 'https://example.com/a.png' },
      { faviconUrl: null }
    ])
  })
})
