import type { Session } from 'electron'
import { getProxySessionApplicationReadiness } from './proxy-settings'

/**
 * Only schemes a proxy can route. Why: an unfiltered listener sends every
 * request — including the ~450 file:// modules the renderer loads at boot —
 * through the main-process JS thread while startup keeps it busy.
 */
export const PROXIED_REQUEST_URL_PATTERNS = ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']

/** Hold default-session network requests until the newest app-wide proxy transition settles. */
export function installElectronProxyRequestGuard(proxySession: Session): void {
  proxySession.webRequest.onBeforeRequest(
    { urls: PROXIED_REQUEST_URL_PATTERNS },
    (_details, callback) => {
      const readiness = getProxySessionApplicationReadiness(proxySession)
      const answer = (ready: boolean): void => callback(ready ? {} : { cancel: true })
      if (typeof readiness === 'boolean') {
        answer(readiness)
      } else {
        void readiness.then(answer)
      }
    }
  )
}
