import { describe, expect, it } from 'vitest'
import {
  DESIGN_BACK_EDGE_CLEARANCE,
  DESIGN_BACK_EDGE_STUB,
  designBackEdgePath,
  designBackEdgeRouteY,
  roundedPolylinePath,
  type DesignRect
} from './design-back-edge-path'

const entrada: DesignRect = { x: 0, y: 0, width: 280, height: 150 }
const validacao: DesignRect = { x: 400, y: 0, width: 280, height: 200 }
const erro: DesignRect = { x: 800, y: 220, width: 280, height: 140 }
const farAway: DesignRect = { x: 2000, y: 0, width: 280, height: 900 }

describe('designBackEdgeRouteY', () => {
  it('runs below every card the route spans, ignoring cards outside it', () => {
    const source = { x: 1080, y: 330 }
    const target = { x: 0, y: 20 }
    expect(designBackEdgeRouteY(source, target, [entrada, validacao, erro, farAway])).toBe(
      360 + DESIGN_BACK_EDGE_CLEARANCE
    )
  })

  it('stays below its own endpoints when no card is lower', () => {
    expect(designBackEdgeRouteY({ x: 280, y: 500 }, { x: 0, y: 20 }, [entrada])).toBe(
      500 + DESIGN_BACK_EDGE_CLEARANCE
    )
  })
})

describe('designBackEdgePath', () => {
  it('leaves right, runs under the cards, and enters the target from the left', () => {
    const source = { x: 1080, y: 330 }
    const target = { x: 0, y: 20 }
    const route = designBackEdgePath(source, target, [entrada, validacao, erro])
    const routeY = 360 + DESIGN_BACK_EDGE_CLEARANCE
    expect(route.labelY).toBe(routeY)
    expect(route.labelX).toBe((1080 + DESIGN_BACK_EDGE_STUB + -DESIGN_BACK_EDGE_STUB) / 2)
    expect(route.path.startsWith('M 1080 330')).toBe(true)
    expect(route.path.endsWith('L 0 20')).toBe(true)
    // Every vertex of the bottom run sits below all three cards.
    const ys = [...route.path.matchAll(/[LQ] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]))
    expect(Math.max(...ys)).toBe(routeY)
  })

  it('routes a self-loop around its own card', () => {
    const route = designBackEdgePath({ x: 280, y: 100 }, { x: 0, y: 20 }, [entrada])
    expect(route.labelY).toBe(150 + DESIGN_BACK_EDGE_CLEARANCE)
  })
})

describe('roundedPolylinePath', () => {
  it('draws straight lines when there is no corner', () => {
    expect(
      roundedPolylinePath([
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ])
    ).toBe('M 0 0 L 10 0')
  })

  it('rounds each corner with a quadratic curve no larger than half a segment', () => {
    expect(
      roundedPolylinePath([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 100 }
      ])
    ).toBe('M 0 0 L 2 0 Q 4 0 4 2 L 4 100')
  })
})
