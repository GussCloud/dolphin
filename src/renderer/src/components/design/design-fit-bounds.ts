import {
  DESIGN_BACK_EDGE_CLEARANCE,
  DESIGN_BACK_EDGE_LANE_GAP,
  DESIGN_BACK_EDGE_STUB,
  type DesignRect
} from './design-back-edge-path'

/** Half an edge label's height, so the lowest lane's label is not cut at the frame. */
const LANE_LABEL_MARGIN = 12

/**
 * The rect fitView should frame: every card plus the back-edge lanes routed below them (and the
 * stubs beside them). The lowest lane can sit at most `(lanes - 1)` gaps under the deepest card.
 */
export function designFitBounds(
  cards: readonly DesignRect[],
  backEdgeCount: number
): DesignRect | null {
  if (cards.length === 0) {
    return null
  }
  const left = Math.min(...cards.map((card) => card.x))
  const top = Math.min(...cards.map((card) => card.y))
  const right = Math.max(...cards.map((card) => card.x + card.width))
  const bottom = Math.max(...cards.map((card) => card.y + card.height))
  if (backEdgeCount <= 0) {
    return { x: left, y: top, width: right - left, height: bottom - top }
  }
  const laneBottom =
    bottom +
    DESIGN_BACK_EDGE_CLEARANCE +
    (backEdgeCount - 1) * DESIGN_BACK_EDGE_LANE_GAP +
    LANE_LABEL_MARGIN
  const x = left - DESIGN_BACK_EDGE_STUB
  return {
    x,
    y: top,
    width: right + DESIGN_BACK_EDGE_STUB - x,
    height: laneBottom - top
  }
}
