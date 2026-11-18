// Running CSS animations make the compositor tick every refresh even when scrolled out of view or clipped.
export const OFFSCREEN_ANIMATION_ATTRIBUTE = 'data-animation-offscreen'

let observer: IntersectionObserver | null = null
let observedCount = 0

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver !== 'function') {
    return null
  }
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      entry.target.toggleAttribute(OFFSCREEN_ANIMATION_ATTRIBUTE, !entry.isIntersecting)
    }
  })
  return observer
}

/** Ref callback: marks the element while it is outside the viewport so CSS can stop its animation. */
export function observeOffscreenAnimation(element: Element | null): () => void {
  // Why: React 19 never pairs a null call with a cleanup, so it must not create the observer.
  if (element === null) {
    return () => {}
  }
  const shared = getObserver()
  if (shared === null) {
    return () => {}
  }
  shared.observe(element)
  observedCount++
  return () => {
    shared.unobserve(element)
    element.removeAttribute(OFFSCREEN_ANIMATION_ATTRIBUTE)
    observedCount--
    if (observedCount === 0) {
      shared.disconnect()
      observer = null
    }
  }
}
