// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { installBodyOverlayAttributes } from './body-overlay-attributes'

const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function appendOverlay(slot: string, state = 'open'): HTMLElement {
  const overlay = document.createElement('div')
  overlay.dataset.slot = slot
  overlay.dataset.state = state
  document.body.append(overlay)
  return overlay
}

describe('installBodyOverlayAttributes', () => {
  let dispose: (() => void) | null = null

  afterEach(() => {
    dispose?.()
    dispose = null
    document.body.replaceChildren()
  })

  it('mirrors a body-level dialog or sheet overlay onto the body', async () => {
    dispose = installBodyOverlayAttributes()
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(false)

    const dialog = appendOverlay('dialog-overlay')
    await flushMutations()
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(true)

    dialog.remove()
    appendOverlay('sheet-overlay')
    await flushMutations()
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(true)
  })

  it('clears the attribute once the overlay starts its closing fade', async () => {
    dispose = installBodyOverlayAttributes()
    const dialog = appendOverlay('dialog-overlay')
    await flushMutations()
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(true)

    dialog.dataset.state = 'closed'
    await flushMutations()
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(false)
  })

  it('ignores overlays nested below a body child and unrelated portals', async () => {
    dispose = installBodyOverlayAttributes()
    const host = document.createElement('div')
    document.body.append(host)
    host.append(document.createElement('div'))
    const nested = document.createElement('div')
    nested.dataset.slot = 'dialog-overlay'
    host.append(nested)
    document.body.append(document.createElement('div'))
    await flushMutations()
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(false)
  })

  it('installs once and removes the attribute on dispose', async () => {
    dispose = installBodyOverlayAttributes()
    expect(installBodyOverlayAttributes()).toBe(dispose)
    appendOverlay('dialog-overlay')
    await flushMutations()
    dispose()
    dispose = null
    expect(document.body.hasAttribute('data-modal-overlay-open')).toBe(false)
  })
})
