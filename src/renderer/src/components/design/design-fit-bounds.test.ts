import { describe, expect, it } from 'vitest'
import { designBackEdgeRouteY } from './design-back-edge-path'
import { designFitBounds } from './design-fit-bounds'

const cards = [
  { x: 0, y: 0, width: 280, height: 120 },
  { x: 480, y: 40, width: 280, height: 200 }
]

describe('designFitBounds', () => {
  it('frames only the cards when nothing routes below them', () => {
    expect(designFitBounds(cards, 0)).toEqual({ x: 0, y: 0, width: 760, height: 240 })
  })

  it('reaches below the lowest back-edge lane', () => {
    const bounds = designFitBounds(cards, 3)
    const lowestLane = designBackEdgeRouteY({ x: 760, y: 100 }, { x: 0, y: 20 }, cards, 2)
    expect(bounds).not.toBeNull()
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeGreaterThan(lowestLane)
    expect(bounds?.x).toBeLessThan(0)
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeGreaterThan(760)
  })

  it('returns null for an empty canvas', () => {
    expect(designFitBounds([], 2)).toBeNull()
  })
})
