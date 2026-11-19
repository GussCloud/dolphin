import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes
} from '@xyflow/react'
import type { DesignCanvas as DesignCanvasModel } from '../../../../shared/design-types'
import {
  designCanvasToFlow,
  DESIGN_BACK_EDGE_TYPE,
  DESIGN_GROUP_NODE_TYPE
} from './design-canvas-flow'
import { DesignBackEdge } from './DesignBackEdge'
import { DesignGroupNode } from './DesignGroupNode'
import './design-canvas.css'

const NODE_TYPES: NodeTypes = { [DESIGN_GROUP_NODE_TYPE]: DesignGroupNode }
const EDGE_TYPES: EdgeTypes = { [DESIGN_BACK_EDGE_TYPE]: DesignBackEdge }
const LABEL_BG_PADDING: [number, number] = [6, 3]
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 }

/** Read-only in this phase: pan and zoom, no dragging, connecting or selecting. */
export default function DesignCanvas({ canvas }: { canvas: DesignCanvasModel }): React.JSX.Element {
  const flow = useMemo(() => designCanvasToFlow(canvas), [canvas])
  const edges = useMemo(
    () =>
      flow.edges.map((edge) => ({
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        labelBgPadding: LABEL_BG_PADDING,
        labelBgBorderRadius: 4
      })),
    [flow.edges]
  )
  return (
    <div data-design-canvas="" className="h-full w-full">
      <ReactFlow
        nodes={flow.nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
        {/* Why: bottom-right is covered by the app's floating workspace-board button. */}
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  )
}
