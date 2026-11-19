import type { DesignRect } from './design-back-edge-path'

export type DesignViewport = { x: number; y: number; zoom: number }

/**
 * The viewport a canvas opens at. Fits everything when that stays readable; otherwise holds the
 * readable zoom and anchors at the flow's start (left edge, first column centered vertically), so
 * the user pans right through a long flow instead of facing an unreadable overview.
 */
export function designOpeningViewport(input: {
  /** Everything a full fit frames (cards plus back-edge lanes). */
  bounds: DesignRect
  cards: readonly DesignRect[]
  width: number
  height: number
  /** Screen pixels kept around the framed content. */
  padding: number
  readableZoom: number
  maxZoom: number
}): DesignViewport {
  const { bounds, cards, width, height, padding, readableZoom, maxZoom } = input
  const fitZoom = Math.min(
    (width - 2 * padding) / Math.max(bounds.width, 1),
    (height - 2 * padding) / Math.max(bounds.height, 1),
    maxZoom
  )
  if (fitZoom >= readableZoom) {
    return {
      zoom: fitZoom,
      x: (width - bounds.width * fitZoom) / 2 - bounds.x * fitZoom,
      y: (height - bounds.height * fitZoom) / 2 - bounds.y * fitZoom
    }
  }
  const zoom = readableZoom
  const startX = Math.min(...cards.map((card) => card.x))
  // Why: auto-layout columns share an x, so the first column is the cards starting at the left edge.
  const firstColumn = cards.filter((card) => card.x <= startX + 1)
  const top = Math.min(...firstColumn.map((card) => card.y))
  const bottom = Math.max(...firstColumn.map((card) => card.y + card.height))
  const columnHeight = (bottom - top) * zoom
  // Why: a column taller than the screen starts at its top instead of being cut on both ends.
  const y =
    columnHeight + 2 * padding > height
      ? padding - top * zoom
      : height / 2 - ((top + bottom) / 2) * zoom
  return { zoom, x: padding - bounds.x * zoom, y }
}
