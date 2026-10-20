import {
  DASHBOARD_BUCKET_ORDER,
  type DashboardCard,
  type DashboardCardDotState,
  type DashboardCardSubagent
} from '../../../../shared/dashboard-snapshot'

export const AGENT_GRAPH_NODE_WIDTH = 232
export const AGENT_GRAPH_AGENT_NODE_HEIGHT = 64
export const AGENT_GRAPH_SUBAGENT_NODE_HEIGHT = 32
const COLUMN_GAP = 40
const ROW_GAP = 10
const TREE_GAP = 22

export type AgentGraphNode =
  | {
      kind: 'agent'
      id: string
      card: DashboardCard
      x: number
      y: number
      height: number
    }
  | {
      kind: 'subagent'
      id: string
      subagent: DashboardCardSubagent
      x: number
      y: number
      height: number
    }

export type AgentGraphEdge = {
  id: string
  fromId: string
  toId: string
  /** Child state drives the edge emphasis, so a blocked leaf is traceable to its root. */
  childState: DashboardCardDotState
  subagent: boolean
  path: string
}

export type AgentGraphLayout = {
  nodes: AgentGraphNode[]
  edges: AgentGraphEdge[]
  width: number
  height: number
}

type TreeItem =
  | { kind: 'agent'; card: DashboardCard; children: TreeItem[] }
  | { kind: 'subagent'; parentPaneKey: string; subagent: DashboardCardSubagent }

function bucketRank(card: DashboardCard): number {
  return DASHBOARD_BUCKET_ORDER.indexOf(card.bucket)
}

function compareRoots(a: DashboardCard, b: DashboardCard): number {
  return bucketRank(a) - bucketRank(b) || a.startedAt - b.startedAt
}

/** Parent links only count when the parent is visible and the chain is acyclic. */
function resolveParents(cards: readonly DashboardCard[]): Map<string, string> {
  const byPaneKey = new Map(cards.map((card) => [card.paneKey, card]))
  const parentByPaneKey = new Map<string, string>()
  for (const card of cards) {
    const parent = card.parentPaneKey
    if (!parent || parent === card.paneKey || !byPaneKey.has(parent)) {
      continue
    }
    const seen = new Set([card.paneKey])
    let cursor: string | undefined = parent
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      cursor = parentByPaneKey.get(cursor) ?? byPaneKey.get(cursor)?.parentPaneKey
    }
    if (!cursor) {
      parentByPaneKey.set(card.paneKey, parent)
    }
  }
  return parentByPaneKey
}

function buildForest(cards: readonly DashboardCard[]): TreeItem[] {
  const parentByPaneKey = resolveParents(cards)
  const childrenByPaneKey = new Map<string, DashboardCard[]>()
  const roots: DashboardCard[] = []
  for (const card of cards) {
    const parent = parentByPaneKey.get(card.paneKey)
    if (!parent) {
      roots.push(card)
      continue
    }
    const siblings = childrenByPaneKey.get(parent)
    if (siblings) {
      siblings.push(card)
    } else {
      childrenByPaneKey.set(parent, [card])
    }
  }
  const toItem = (card: DashboardCard): TreeItem => ({
    kind: 'agent',
    card,
    children: [
      ...(childrenByPaneKey.get(card.paneKey) ?? [])
        .sort((a, b) => a.startedAt - b.startedAt)
        .map(toItem),
      ...(card.subagents ?? []).map((subagent): TreeItem => ({
        kind: 'subagent',
        parentPaneKey: card.paneKey,
        subagent
      }))
    ]
  })
  return roots.sort(compareRoots).map(toItem)
}

function edgePath(from: AgentGraphNode, to: AgentGraphNode): string {
  const x1 = from.x + AGENT_GRAPH_NODE_WIDTH
  const y1 = from.y + from.height / 2
  const x2 = to.x
  const y2 = to.y + to.height / 2
  const midX = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
}

/** Left-to-right tidy tree: depth picks the column, leaves stack down the rows,
 *  and each parent is centered on the vertical span of its subtree. */
export function layoutAgentGraph(cards: readonly DashboardCard[]): AgentGraphLayout {
  const nodes: AgentGraphNode[] = []
  const edges: AgentGraphEdge[] = []
  let cursorY = 0
  let maxDepth = 0

  const place = (item: TreeItem, depth: number): AgentGraphNode => {
    maxDepth = Math.max(maxDepth, depth)
    const x = depth * (AGENT_GRAPH_NODE_WIDTH + COLUMN_GAP)
    if (item.kind === 'subagent') {
      const node: AgentGraphNode = {
        kind: 'subagent',
        id: `${item.parentPaneKey}::${item.subagent.id}`,
        subagent: item.subagent,
        x,
        y: cursorY,
        height: AGENT_GRAPH_SUBAGENT_NODE_HEIGHT
      }
      nodes.push(node)
      cursorY += node.height + ROW_GAP
      return node
    }

    const height = AGENT_GRAPH_AGENT_NODE_HEIGHT
    const node: AgentGraphNode = {
      kind: 'agent',
      id: item.card.paneKey,
      card: item.card,
      x,
      y: 0,
      height
    }
    nodes.push(node)
    if (item.children.length === 0) {
      node.y = cursorY
      cursorY += height + ROW_GAP
      return node
    }

    const spanTop = cursorY
    const firstDescendant = nodes.length
    const children = item.children.map((child) => place(child, depth + 1))
    const span = cursorY - ROW_GAP - spanTop
    if (span < height) {
      // Why: a parent taller than its children's span would overlap the next sibling.
      const shift = (height - span) / 2
      for (let index = firstDescendant; index < nodes.length; index += 1) {
        nodes[index].y += shift
      }
      cursorY = spanTop + height + ROW_GAP
    }
    node.y = (spanTop + cursorY - ROW_GAP) / 2 - height / 2
    for (const child of children) {
      edges.push({
        id: `${node.id}->${child.id}`,
        fromId: node.id,
        toId: child.id,
        childState: child.kind === 'agent' ? child.card.dotState : child.subagent.dotState,
        subagent: child.kind === 'subagent',
        path: ''
      })
    }
    return node
  }

  for (const root of buildForest(cards)) {
    place(root, 0)
    cursorY += TREE_GAP - ROW_GAP
  }

  // Paths are resolved last because subtree shifts move nodes after their edges are recorded.
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const edge of edges) {
    const from = byId.get(edge.fromId)
    const to = byId.get(edge.toId)
    if (from && to) {
      edge.path = edgePath(from, to)
    }
  }

  return {
    nodes,
    edges,
    width:
      nodes.length === 0 ? 0 : (maxDepth + 1) * (AGENT_GRAPH_NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP,
    height: nodes.length === 0 ? 0 : Math.max(0, cursorY - TREE_GAP)
  }
}
