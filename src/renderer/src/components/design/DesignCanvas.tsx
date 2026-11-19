import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  getViewportForBounds,
  MarkerType,
  ReactFlow,
  useInternalNodes,
  useReactFlow,
  useViewportStore,
  type EdgeTypes,
  type NodeTypes
} from '@xyflow/react'
import type { DesignCanvas as DesignCanvasModel } from '../../../../shared/design-types'
import {
  designCanvasToFlow,
  DESIGN_BACK_EDGE_TYPE,
  DESIGN_GROUP_NODE_TYPE
} from './design-canvas-flow'
import type { DesignRect } from './design-back-edge-path'
import { designFitBounds } from './design-fit-bounds'
import { DesignBackEdge } from './DesignBackEdge'
import { DesignGroupNode } from './DesignGroupNode'
import './design-canvas.css'

const NODE_TYPES: NodeTypes = { [DESIGN_GROUP_NODE_TYPE]: DesignGroupNode }
const EDGE_TYPES: EdgeTypes = { [DESIGN_BACK_EDGE_TYPE]: DesignBackEdge }
const LABEL_BG_PADDING: [number, number] = [6, 3]
const MIN_ZOOM = 0.2
const FIT_MAX_ZOOM = 1
// Why: explicit unit; xyflow 13 reads bare numbers and percentages differently from v12.
const FIT_PADDING = '32px'

/** Frames the cards and the back-edge lanes below them; xyflow's own fitView sees only the cards. */
function DesignFitControls({
  nodeIds,
  backEdgeCount,
  fitKey
}: {
  nodeIds: readonly string[]
  backEdgeCount: number
  /** The canvas version: the view refits when it changes, not on every refetch. */
  fitKey: number
}): React.JSX.Element {
  const flow = useReactFlow()
  // Why: useNodesInitialized never turns true for controlled nodes; internal nodes carry the size.
  const internalNodes = useInternalNodes(nodeIds)
  const cards = useMemo(
    () =>
      internalNodes.map((node): DesignRect => ({
        x: node.internals.positionAbsolute.x,
        y: node.internals.positionAbsolute.y,
        width: node.measured.width ?? 0,
        height: node.measured.height ?? 0
      })),
    [internalNodes]
  )
  const measured =
    cards.length === nodeIds.length && cards.every((card) => card.width > 0 && card.height > 0)
  const width = useViewportStore((state) => state.width)
  const height = useViewportStore((state) => state.height)
  const fittedKey = useRef<number | null>(null)

  const fit = useCallback(async (): Promise<boolean> => {
    const bounds = designFitBounds(cards, backEdgeCount)
    if (!bounds || width === 0 || height === 0) {
      return false
    }
    return flow.setViewport(
      getViewportForBounds(bounds, width, height, MIN_ZOOM, FIT_MAX_ZOOM, FIT_PADDING)
    )
  }, [backEdgeCount, cards, flow, height, width])

  // Why: setViewport is a no-op until the pan/zoom behavior mounts, so wait for it and the sizes.
  useEffect(() => {
    if (!measured || !flow.viewportInitialized || fittedKey.current === fitKey) {
      return
    }
    void fit().then((applied) => {
      if (applied) {
        fittedKey.current = fitKey
      }
    })
  }, [fit, fitKey, flow.viewportInitialized, measured])

  // Why: bottom-right is covered by the app's floating workspace-board button.
  return <Controls showInteractive={false} position="bottom-left" onFitView={() => void fit()} />
}

/** Pan and zoom only: blocks open a thread popover, nothing drags, connects or selects. */
export default function DesignCanvas({
  canvas,
  version
}: {
  canvas: DesignCanvasModel
  version: number
}): React.JSX.Element {
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
  const nodeIds = useMemo(() => flow.nodes.map((node) => node.id), [flow.nodes])
  const backEdgeCount = flow.edges.filter((edge) => edge.type === DESIGN_BACK_EDGE_TYPE).length
  return (
    <div data-design-canvas="" className="h-full w-full">
      <ReactFlow
        nodes={flow.nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        minZoom={MIN_ZOOM}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
        <DesignFitControls nodeIds={nodeIds} backEdgeCount={backEdgeCount} fitKey={version} />
      </ReactFlow>
    </div>
  )
}
