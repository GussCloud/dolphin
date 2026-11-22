import { isBrowserChromeShortcutTarget } from '../describe-page/browser-overlay-shortcut-target'

/**
 * Mirrors "focus is in a browser pane's chrome" to main, whose before-input-event otherwise
 * claims chords like Mod+L for window shortcuts before the chrome's keydown sees them.
 */
export function installBrowserChromeFocusReporting(): () => void {
  let lastReported: boolean | null = null
  const report = (target: EventTarget | null): void => {
    const focused = isBrowserChromeShortcutTarget(target)
    if (focused === lastReported) {
      return
    }
    lastReported = focused
    // Dev reloads can pair a new renderer with an older preload.
    window.api.ui.setBrowserChromeFocused?.(focused)
  }
  const onFocusIn = (event: FocusEvent): void => report(event.target)
  const onFocusOut = (event: FocusEvent): void => report(event.relatedTarget)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)
  report(document.activeElement)
  return () => {
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    report(null)
  }
}
