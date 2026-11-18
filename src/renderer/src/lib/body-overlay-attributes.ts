const MOUNTED_MODAL_OVERLAY_CHILD_SELECTOR =
  ":scope > :is([data-slot='dialog-overlay'], [data-slot='sheet-overlay'])"
// Radix keeps a closing overlay mounted through its fade; it must not hold modal styling past the dim.
const MODAL_OVERLAY_CHILD_SELECTOR = `${MOUNTED_MODAL_OVERLAY_CHILD_SELECTOR}:not([data-state='closed'])`

let disposeInstalledObserver: (() => void) | null = null

/** Mirror body-level modal overlays onto `body[data-modal-overlay-open]` for CSS. A body:has() rule
 *  with a descendant subject made Chromium restyle the whole document on every DOM mutation. */
export function installBodyOverlayAttributes(): () => void {
  if (disposeInstalledObserver) {
    return disposeInstalledObserver
  }
  const body = document.body
  const observer = new MutationObserver(() => sync())
  const sync = (): void => {
    for (const overlay of body.querySelectorAll(MOUNTED_MODAL_OVERLAY_CHILD_SELECTOR)) {
      observer.observe(overlay, { attributes: true, attributeFilter: ['data-state'] })
    }
    // toggleAttribute is a no-op when the state is unchanged, so unrelated portals cost no restyle.
    body.toggleAttribute(
      'data-modal-overlay-open',
      body.querySelector(MODAL_OVERLAY_CHILD_SELECTOR) !== null
    )
  }
  sync()
  // Overlays portal as direct body children; watching only those and overlay state skips app mutations.
  observer.observe(body, { childList: true })
  disposeInstalledObserver = () => {
    observer.disconnect()
    body.removeAttribute('data-modal-overlay-open')
    disposeInstalledObserver = null
  }
  return disposeInstalledObserver
}
