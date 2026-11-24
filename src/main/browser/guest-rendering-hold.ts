import type { WebContents } from 'electron'
import { rendererPublicationThrottle } from '../window/renderer-publication-throttle'

/**
 * Keeps a guest's timers and compositor running while it is hidden. Guests stay throttled
 * otherwise; the hold ends on release or when the guest is destroyed, whichever comes first.
 */
export function holdGuestRendering(guest: WebContents): () => void {
  if (guest.isDestroyed()) {
    return () => {}
  }
  const releaseThrottle = rendererPublicationThrottle.acquire(guest)
  let released = false
  const release = (): void => {
    if (released) {
      return
    }
    released = true
    guest.removeListener('destroyed', release)
    releaseThrottle()
  }
  guest.once('destroyed', release)
  return release
}
