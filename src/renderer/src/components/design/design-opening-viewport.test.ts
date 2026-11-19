import { describe, expect, it } from 'vitest'
import { designOpeningViewport } from './design-opening-viewport'

const card = (x: number, y: number, height = 200) => ({ x, y, width: 280, height })
const base = { width: 900, height: 800, padding: 32, readableZoom: 0.6, maxZoom: 1 }

describe('designOpeningViewport', () => {
  it('fits and centers a canvas that stays readable', () => {
    const cards = [card(0, 0), card(480, 0), card(960, 0)]
    const bounds = { x: 0, y: 0, width: 1240, height: 200 }
    const viewport = designOpeningViewport({ ...base, bounds, cards })
    expect(viewport.zoom).toBeCloseTo((900 - 64) / 1240)
    const screenLeft = viewport.x + bounds.x * viewport.zoom
    const screenRight = viewport.x + (bounds.x + bounds.width) * viewport.zoom
    expect(screenLeft).toBeCloseTo(900 - screenRight)
  })

  it('caps the fit at the maximum zoom', () => {
    const viewport = designOpeningViewport({
      ...base,
      bounds: { x: 0, y: 0, width: 280, height: 200 },
      cards: [card(0, 0)]
    })
    expect(viewport.zoom).toBe(1)
  })

  it('holds the readable zoom, anchors a long flow at its left edge and centers its height', () => {
    // The first card is short and the branches run below it: the flow's middle is at y=300, not 100.
    const cards = Array.from({ length: 13 }, (_, index) => card(index * 480, index === 0 ? 0 : 400))
    const bounds = { x: -24, y: 0, width: 13 * 480, height: 600 }
    const viewport = designOpeningViewport({ ...base, bounds, cards })
    expect(viewport.zoom).toBe(0.6)
    expect(viewport.x + bounds.x * viewport.zoom).toBe(32)
    expect(viewport.y + 300 * viewport.zoom).toBeCloseTo(400)
  })

  it('centers the first column when the whole flow is too tall to fit', () => {
    const cards = [card(0, 100), card(480, 0, 1600)]
    const bounds = { x: 0, y: 0, width: 13 * 480, height: 1600 }
    const viewport = designOpeningViewport({ ...base, bounds, cards })
    expect(viewport.y + 200 * viewport.zoom).toBeCloseTo(400)
  })

  it('starts a first column taller than the screen at its top', () => {
    const cards = [card(0, 0, 2000), card(480, 0)]
    const viewport = designOpeningViewport({
      ...base,
      bounds: { x: 0, y: 0, width: 13 * 480, height: 2000 },
      cards
    })
    expect(viewport.zoom).toBe(0.6)
    expect(viewport.y).toBe(32)
  })
})
