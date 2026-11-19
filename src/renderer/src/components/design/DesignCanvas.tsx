import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  DESIGN_GROUP_NODE_TYPE,
  type DesignGroupNode as DesignGroupFlowNode
} from './design-canvas-flow'
import { designHeightsApplied } from './design-canvas-layout'
import type { DesignRect } from './design-back-edge-path'
import { designFitBounds } from './design-fit-bounds'
import { designOpeningViewport } from './design-opening-viewport'
import { DesignBackEdge } from './DesignBackEdge'
import { DesignGroupNode } from './DesignGroupNode'
import './design-canvas.css'

const NODE_TYPES: NodeTypes = { [DESIGN_GROUP_NODE_TYPE]: DesignGroupNode }
const EDGE_TYPES: EdgeTypes = { [DESIGN_BACK_EDGE_TYPE]: DesignBackEdge }
const LABEL_BG_PADDING: [number, number] = [6, 3]
const MIN_ZOOM = 0.2
const FIT_MAX_ZOOM = 1
const FIT_PADDING_PX = 32
// Why: explicit unit; xyflow 13 reads bare numbers and percentages differently from v12.
const FIT_PADDING = `${FIT_PADDING_PX}px`
/** Below this the block titles stop being legible, so opening a long flow anchors at its start. */
const READABLE_ZOOM = 0.6

/** Frames the cards and the back-edge lanes below them; xyflow's own fitView sees only the cards. */
function DesignFitControls({
  nodes,
  backEdgeCount,
  fitKey,
  appliedHeights,
  onMeasuredHeights,
  userMovedRef
}: {
  nodes: readonly DesignGroupFlowNode[]
  backEdgeCount: number
  /** The canvas version: the view refits when it changes, not on every refetch. */
  fitKey: number
  /** Card heights the current layout stacked with; null while it still uses the estimate. */
  appliedHeights: ReadonlyMap<string, number> | null
  onMeasuredHeights: (heights: ReadonlyMap<string, number>) => void
  /** Set once the user pans or zooms; from then on a resize no longer refits. */
  userMovedRef: React.RefObject<boolean>
}): React.JSX.Element {
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes])
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
  const measuredHeights = useMemo(
    () =>
      new Map(measured ? internalNodes.map((node) => [node.id, node.measured.height ?? 0]) : []),
    [internalNodes, measured]
  )
  const heightsApplied = measured && designHeightsApplied(measuredHeights, appliedHeights)
  // Why: the store lags one render behind a new layout; fit only once cards sit where it put them.
  const positionsApplied = internalNodes.every((node, index) => {
    const expected = nodes[index]?.position
    return (
      expected !== undefined &&
      node.internals.positionAbsolute.x === expected.x &&
      node.internals.positionAbsolute.y === expected.y
    )
  })
  const settled = heightsApplied && positionsApplied

  // Why: the estimate only places the first paint; real heights re-stack the auto-laid columns.
  useEffect(() => {
    if (measured && !heightsApplied) {
      onMeasuredHeights(measuredHeights)
    }
  }, [heightsApplied, measured, measuredHeights, onMeasuredHeights])
  const width = useViewportStore((state) => state.width)
  const height = useViewportStore((state) => state.height)
  const fitted = useRef<{ key: number; width: number; height: number } | null>(null)

  /** The fit-view button: always everything, whatever the zoom. */
  const fitAll = useCallback(async (): Promise<boolean> => {
    const bounds = designFitBounds(cards, backEdgeCount)
    if (!bounds || width === 0 || height === 0) {
      return false
    }
    return flow.setViewport(
      getViewportForBounds(bounds, width, height, MIN_ZOOM, FIT_MAX_ZOOM, FIT_PADDING)
    )
  }, [backEdgeCount, cards, flow, height, width])

  const openAtStart = useCallback(async (): Promise<boolean> => {
    const bounds = designFitBounds(cards, backEdgeCount)
    if (!bounds || width === 0 || height === 0) {
      return false
    }
    return flow.setViewport(
      designOpeningViewport({
        bounds,
        cards,
        width,
        height,
        padding: FIT_PADDING_PX,
        readableZoom: READABLE_ZOOM,
        maxZoom: FIT_MAX_ZOOM
      })
    )
  }, [backEdgeCount, cards, flow, height, width])

  // Why: setViewport is a no-op until the pan/zoom behavior mounts, so wait for it and the sizes.
  // Why: banners above the canvas mount after it and shrink it; refit until the user moves the view.
  useEffect(() => {
    if (!settled || !flow.viewportInitialized) {
      return
    }
    const last = fitted.current
    if (
      last?.key === fitKey &&
      (userMovedRef.current || (last.width === width && last.height === height))
    ) {
      return
    }
    void openAtStart().then((applied) => {
      if (applied) {
        fitted.current = { key: fitKey, width, height }
      }
    })
  }, [fitKey, flow.viewportInitialized, height, openAtStart, settled, userMovedRef, width])

  // Why: bottom-right is covered by the app's floating workspace-board button.
  return <Controls showInteractive={false} position="bottom-left" onFitView={() => void fitAll()} />
}

/** Pan and zoom only: blocks open a thread popover, nothing drags, connects or selects. */
export default function DesignCanvas({
  canvas,
  version
}: {
  canvas: DesignCanvasModel
  version: number
}): React.JSX.Element {
  const [measuredHeights, setMeasuredHeights] = useState<ReadonlyMap<string, number> | null>(null)
  const userMovedRef = useRef(false)
  // Why: a new canvas version refits through its fitKey; from then on resizes may refit it again.
  useEffect(() => {
    userMovedRef.current = false
  }, [version])
  const flow = useMemo(
    () => designCanvasToFlow(canvas, measuredHeights ?? undefined),
    [canvas, measuredHeights]
  )
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
        onMoveStart={(event) => {
          // Why: programmatic fits pass a null event; only a real pan or zoom pins the view.
          if (event) {
            userMovedRef.current = true
          }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
        <DesignFitControls
          nodes={flow.nodes}
          backEdgeCount={backEdgeCount}
          fitKey={version}
          appliedHeights={measuredHeights}
          onMeasuredHeights={setMeasuredHeights}
          userMovedRef={userMovedRef}
        />
      </ReactFlow>
    </div>
  )
}
