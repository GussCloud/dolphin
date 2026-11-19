// Type-only imports keep this module free of the xyflow runtime, which loads only with the canvas.
import type { Edge, Node } from '@xyflow/react'
import type { DesignCanvas, DesignGroup } from '../../../../shared/design-types'
import { layoutDesignCanvas } from './design-canvas-layout'

export const DESIGN_GROUP_NODE_TYPE = 'designGroup'
/** An edge into a card at or left of its source card; drawn around the cards instead of through them. */
export const DESIGN_BACK_EDGE_TYPE = 'designBack'
export const DESIGN_GROUP_TARGET_HANDLE = 'in'
export const DESIGN_GROUP_SOURCE_HANDLE = 'out'

export function designBlockSourceHandle(blockId: string): string {
  return `block:${blockId}`
}

export type DesignGroupNodeData = {
  group: DesignGroup
  /** Blocks that start an edge and so need a source handle. */
  sourceBlockIds: string[]
  /** An edge leaves the group itself (no block), so the group needs its own source handle. */
  hasGroupSource: boolean
  hasIncoming: boolean
}

export type DesignGroupNode = Node<DesignGroupNodeData, typeof DESIGN_GROUP_NODE_TYPE>

export function designCanvasToFlow(canvas: DesignCanvas): {
  nodes: DesignGroupNode[]
  edges: Edge[]
} {
  const groupsById = new Map(canvas.groups.map((group) => [group.id, group]))
  // Why: an edge whose endpoints are not on this canvas would make xyflow warn and draw nothing; drop it.
  const edges = canvas.edges.filter((edge) => {
    const from = groupsById.get(edge.fromGroupId)
    if (!from || !groupsById.has(edge.toGroupId)) {
      return false
    }
    return (
      edge.fromBlockId === undefined || from.blocks.some((block) => block.id === edge.fromBlockId)
    )
  })
  const positions = layoutDesignCanvas(canvas)
  const isBackEdge = (from: string, to: string): boolean =>
    (positions.get(to)?.x ?? 0) <= (positions.get(from)?.x ?? 0)
  const span = (edge: { fromGroupId: string; toGroupId: string }): number =>
    (positions.get(edge.fromGroupId)?.x ?? 0) - (positions.get(edge.toGroupId)?.x ?? 0)
  // Why: shorter back-edges take the inner lanes, so nested loops do not cross each other.
  const backLanes = new Map(
    edges
      .filter((edge) => isBackEdge(edge.fromGroupId, edge.toGroupId))
      .toSorted((a, b) => span(a) - span(b))
      .map((edge, lane) => [edge.id, lane])
  )
  const nodes = canvas.groups.map((group): DesignGroupNode => {
    const outgoing = edges.filter((edge) => edge.fromGroupId === group.id)
    return {
      id: group.id,
      type: DESIGN_GROUP_NODE_TYPE,
      position: positions.get(group.id) ?? { x: 0, y: 0 },
      // Why: xyflow sets pointer-events none inline on nodes that are neither draggable nor
      // selectable; block rows must still take clicks to open their thread.
      style: { pointerEvents: 'all' },
      data: {
        group,
        sourceBlockIds: outgoing.flatMap((edge) => (edge.fromBlockId ? [edge.fromBlockId] : [])),
        hasGroupSource: outgoing.some((edge) => edge.fromBlockId === undefined),
        hasIncoming: edges.some((edge) => edge.toGroupId === group.id)
      }
    }
  })
  return {
    nodes,
    edges: edges.map((edge): Edge => ({
      id: edge.id,
      source: edge.fromGroupId,
      sourceHandle: edge.fromBlockId
        ? designBlockSourceHandle(edge.fromBlockId)
        : DESIGN_GROUP_SOURCE_HANDLE,
      target: edge.toGroupId,
      targetHandle: DESIGN_GROUP_TARGET_HANDLE,
      ...(backLanes.has(edge.id)
        ? { type: DESIGN_BACK_EDGE_TYPE, data: { lane: backLanes.get(edge.id) } }
        : { type: 'smoothstep' }),
      ...(edge.label ? { label: edge.label } : {})
    }))
  }
}
