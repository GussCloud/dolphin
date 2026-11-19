import { memo, useMemo } from 'react'
import { BaseEdge, useInternalNodes, useNodes, type EdgeProps } from '@xyflow/react'
import { designBackEdgePath, type DesignRect } from './design-back-edge-path'
import { DESIGN_GROUP_WIDTH } from './design-canvas-layout'

const BACK_EDGE_STYLE = { strokeDasharray: '6 4' }

function DesignBackEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius
}: EdgeProps): React.JSX.Element {
  const nodes = useNodes()
  const ids = useMemo(() => nodes.map((node) => node.id), [nodes])
  // Why: internal nodes carry the rendered size; the controlled nodes never get `measured`.
  const cards = useInternalNodes(ids).map((node): DesignRect => ({
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? DESIGN_GROUP_WIDTH,
    height: node.measured.height ?? 0
  }))
  const route = designBackEdgePath({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, cards)
  return (
    <BaseEdge
      path={route.path}
      markerEnd={markerEnd}
      style={BACK_EDGE_STYLE}
      label={label}
      labelX={route.labelX}
      labelY={route.labelY}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  )
}

export const DesignBackEdge = memo(DesignBackEdgeView)
