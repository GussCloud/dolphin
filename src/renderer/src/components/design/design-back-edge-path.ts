export type DesignRect = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

/** How far the route steps out of a handle before turning, and how far below the cards it runs. */
export const DESIGN_BACK_EDGE_STUB = 24
export const DESIGN_BACK_EDGE_CLEARANCE = 40
const CORNER_RADIUS = 10

/** The y a back-edge runs along: below every card whose span overlaps the route horizontally. */
export function designBackEdgeRouteY(
  source: Point,
  target: Point,
  cards: readonly DesignRect[]
): number {
  const left = Math.min(source.x, target.x) - DESIGN_BACK_EDGE_STUB
  const right = Math.max(source.x, target.x) + DESIGN_BACK_EDGE_STUB
  const bottoms = cards
    .filter((card) => card.x < right && card.x + card.width > left)
    .map((card) => card.y + card.height)
  return Math.max(source.y, target.y, ...bottoms) + DESIGN_BACK_EDGE_CLEARANCE
}

/** Orthogonal polyline through `points` with rounded corners, as an SVG path. */
export function roundedPolylinePath(points: readonly Point[]): string {
  if (points.length === 0) {
    return ''
  }
  const parts = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 1; index < points.length - 1; index += 1) {
    const [prev, corner, next] = [points[index - 1], points[index], points[index + 1]]
    const radius = Math.min(
      CORNER_RADIUS,
      Math.hypot(corner.x - prev.x, corner.y - prev.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2
    )
    const before = towards(corner, prev, radius)
    const after = towards(corner, next, radius)
    parts.push(`L ${before.x} ${before.y}`, `Q ${corner.x} ${corner.y} ${after.x} ${after.y}`)
  }
  const last = points.at(-1) ?? points[0]
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}

function towards(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length === 0) {
    return from
  }
  return {
    x: from.x + ((to.x - from.x) / length) * distance,
    y: from.y + ((to.y - from.y) / length) * distance
  }
}

/**
 * Route for an edge that flows backwards (right handle → left handle of an earlier card): out to the
 * right, down below the cards in between, back left, and up into the target, so it never crosses a card.
 */
export function designBackEdgePath(
  source: Point,
  target: Point,
  cards: readonly DesignRect[]
): { path: string; labelX: number; labelY: number } {
  const routeY = designBackEdgeRouteY(source, target, cards)
  const outX = source.x + DESIGN_BACK_EDGE_STUB
  const inX = target.x - DESIGN_BACK_EDGE_STUB
  return {
    path: roundedPolylinePath([
      source,
      { x: outX, y: source.y },
      { x: outX, y: routeY },
      { x: inX, y: routeY },
      { x: inX, y: target.y },
      target
    ]),
    labelX: (outX + inX) / 2,
    labelY: routeY
  }
}
