import type { DesignCanvas, DesignGroup } from '../../../../shared/design-types'

export const DESIGN_GROUP_WIDTH = 280
const COLUMN_GAP = 120
const ROW_GAP = 48
const GROUP_HEADER_HEIGHT = 44
const BLOCK_ROW_HEIGHT = 36
const BLOCK_DESCRIPTION_HEIGHT = 18
const GROUP_PADDING = 12

export type DesignPoint = { x: number; y: number }

/** Rough rendered height, used only to stack auto-laid groups without overlap. */
export function estimateDesignGroupHeight(group: DesignGroup): number {
  const blocks = group.blocks.reduce(
    (sum, block) => sum + BLOCK_ROW_HEIGHT + (block.description ? BLOCK_DESCRIPTION_HEIGHT : 0),
    0
  )
  return GROUP_HEADER_HEIGHT + blocks + GROUP_PADDING
}

/**
 * Depth = BFS distance from a group with no incoming edge. Groups reachable only through a
 * cycle get a fresh root in input order, so every group gets a depth.
 */
export function designGroupDepths(canvas: DesignCanvas): Map<string, number> {
  const ids = new Set(canvas.groups.map((group) => group.id))
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, number>()
  for (const edge of canvas.edges) {
    if (!ids.has(edge.fromGroupId) || !ids.has(edge.toGroupId)) {
      continue
    }
    if (edge.fromGroupId === edge.toGroupId) {
      continue
    }
    outgoing.set(edge.fromGroupId, [...(outgoing.get(edge.fromGroupId) ?? []), edge.toGroupId])
    incoming.set(edge.toGroupId, (incoming.get(edge.toGroupId) ?? 0) + 1)
  }
  const depths = new Map<string, number>()
  const visit = (roots: string[]): void => {
    const queue = roots.filter((id) => !depths.has(id))
    for (const id of queue) {
      depths.set(id, 0)
    }
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index]
      const depth = depths.get(id) ?? 0
      for (const next of outgoing.get(id) ?? []) {
        if (!depths.has(next)) {
          depths.set(next, depth + 1)
          queue.push(next)
        }
      }
    }
  }
  visit(canvas.groups.filter((group) => !incoming.has(group.id)).map((group) => group.id))
  for (const group of canvas.groups) {
    if (!depths.has(group.id)) {
      visit([group.id])
    }
  }
  return depths
}

/** Agent positions win; the rest go left-to-right by depth, stacked in input order per column. */
export function layoutDesignCanvas(canvas: DesignCanvas): Map<string, DesignPoint> {
  const depths = designGroupDepths(canvas)
  const columnHeights = new Map<number, number>()
  const positions = new Map<string, DesignPoint>()
  for (const group of canvas.groups) {
    if (group.position) {
      positions.set(group.id, { x: group.position.x, y: group.position.y })
      continue
    }
    const depth = depths.get(group.id) ?? 0
    const y = columnHeights.get(depth) ?? 0
    positions.set(group.id, { x: depth * (DESIGN_GROUP_WIDTH + COLUMN_GAP), y })
    columnHeights.set(depth, y + estimateDesignGroupHeight(group) + ROW_GAP)
  }
  return positions
}
