import { webContents } from 'electron'
import { rendererPublicationThrottle } from '../window/renderer-publication-throttle'
import { holdGuestRendering } from './guest-rendering-hold'
import { BrowserManagerState } from './browser-manager-state'

export abstract class BrowserManagerVisibility extends BrowserManagerState {
  // Why: page id -> active capture count; the renderer hears only the first hold and the last release.
  private readonly capturePaintHolds = new Map<string, number>()

  // Why: only pixel capture needs a drawn guest. One-way so a minimized or throttled desktop renderer
  // can't stall the capture; the capture itself retries until the page produces a frame.
  holdPaintForCapture(guestWebContentsId: number): () => void {
    // Why: a debugger can stay attached after its agent client left, so the capture itself must unthrottle the guest.
    const guest = webContents.fromId(guestWebContentsId)
    const releaseGuestRendering = guest ? holdGuestRendering(guest) : () => {}
    const browserPageId = this.resolveBrowserTabIdForGuestWebContentsId(guestWebContentsId)
    const renderer = browserPageId ? this.resolveRendererForBrowserTab(browserPageId) : null
    if (!browserPageId || !renderer || renderer.isDestroyed()) {
      return releaseGuestRendering
    }
    const holds = this.capturePaintHolds.get(browserPageId) ?? 0
    this.capturePaintHolds.set(browserPageId, holds + 1)
    if (holds === 0) {
      renderer.send('browser:capturePaintHold', { browserPageId, held: true })
    }
    // Why: a throttled renderer applies the parking change late, which every retry would pay for.
    const releaseThrottle = rendererPublicationThrottle.acquire(renderer)
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      releaseGuestRendering()
      releaseThrottle()
      const remaining = (this.capturePaintHolds.get(browserPageId) ?? 1) - 1
      if (remaining > 0) {
        this.capturePaintHolds.set(browserPageId, remaining)
        return
      }
      this.capturePaintHolds.delete(browserPageId)
      if (!renderer.isDestroyed()) {
        renderer.send('browser:capturePaintHold', { browserPageId, held: false })
      }
    }
  }
}
