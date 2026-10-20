import { describe, expect, it } from 'vitest'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import {
  AGENT_GRAPH_AGENT_NODE_HEIGHT,
  AGENT_GRAPH_NODE_WIDTH,
  layoutAgentGraph,
  type AgentGraphNode
} from './agent-graph-layout'

function card(paneKey: string, overrides: Partial<DashboardCard> = {}): DashboardCard {
  return {
    paneKey,
    ptyId: null,
    agentType: 'claude',
    bucket: 'working',
    dotState: 'working',
    task: '',
    repoId: 'r1',
    worktreeId: 'w1',
    tabId: 't1',
    leafId: null,
    repoName: 'Repo',
    worktreeName: 'wt',
    startedAt: 0,
    finishedAt: null,
    stateChangedAt: 0,
    unseen: false,
    ...overrides
  }
}

function nodeById(nodes: AgentGraphNode[], id: string): AgentGraphNode {
  const node = nodes.find((candidate) => candidate.id === id)
  if (!node) {
    throw new Error(`missing node ${id}`)
  }
  return node
}

function overlaps(a: AgentGraphNode, b: AgentGraphNode): boolean {
  return a.x === b.x && a.y < b.y + b.height && b.y < a.y + a.height
}

describe('layoutAgentGraph', () => {
  it('returns an empty layout for no cards', () => {
    expect(layoutAgentGraph([])).toEqual({ nodes: [], edges: [], width: 0, height: 0 })
  })

  it('places children one column right of their visible parent', () => {
    const layout = layoutAgentGraph([
      card('lead'),
      card('mate-a', { parentPaneKey: 'lead', startedAt: 1 }),
      card('mate-b', { parentPaneKey: 'lead', startedAt: 2, dotState: 'blocked' })
    ])
    const lead = nodeById(layout.nodes, 'lead')
    const a = nodeById(layout.nodes, 'mate-a')
    const b = nodeById(layout.nodes, 'mate-b')
    expect(lead.x).toBe(0)
    expect(a.x).toBeGreaterThan(AGENT_GRAPH_NODE_WIDTH)
    expect(a.y).toBeLessThan(b.y)
    expect(lead.y + lead.height / 2).toBeCloseTo((a.y + b.y + b.height) / 2)
    expect(layout.edges.map((edge) => [edge.fromId, edge.toId, edge.childState])).toEqual([
      ['lead', 'mate-a', 'working'],
      ['lead', 'mate-b', 'blocked']
    ])
    expect(layout.edges.every((edge) => edge.path.startsWith('M '))).toBe(true)
  })

  it('treats a parent outside the visible cards as absent', () => {
    const layout = layoutAgentGraph([card('orphan', { parentPaneKey: 'filtered-out' })])
    expect(nodeById(layout.nodes, 'orphan').x).toBe(0)
    expect(layout.edges).toEqual([])
  })

  it('breaks parent cycles instead of looping', () => {
    const layout = layoutAgentGraph([
      card('a', { parentPaneKey: 'b' }),
      card('b', { parentPaneKey: 'a' })
    ])
    expect(layout.nodes).toHaveLength(2)
    expect(layout.edges).toHaveLength(0)
  })

  it('renders subagents as dashed leaves without overlapping the next tree', () => {
    const layout = layoutAgentGraph([
      card('lead', { subagents: [{ id: 's1', name: 'Explore', dotState: 'working' }] }),
      card('solo', { startedAt: 5 })
    ])
    const lead = nodeById(layout.nodes, 'lead')
    const solo = nodeById(layout.nodes, 'solo')
    const sub = nodeById(layout.nodes, 'lead::s1')
    expect(sub.kind).toBe('subagent')
    expect(layout.edges).toEqual([expect.objectContaining({ toId: 'lead::s1', subagent: true })])
    expect(overlaps(lead, solo)).toBe(false)
    expect(solo.y).toBeGreaterThanOrEqual(lead.y + AGENT_GRAPH_AGENT_NODE_HEIGHT)
    expect(layout.height).toBe(solo.y + solo.height)
  })

  it('keeps nodes in the same column from overlapping in a deep fleet', () => {
    const cards = [card('root')]
    for (let index = 0; index < 6; index += 1) {
      cards.push(
        card(`w${index}`, {
          parentPaneKey: 'root',
          startedAt: index,
          subagents: index % 2 ? [{ id: 'x', name: 'x', dotState: 'idle' }] : undefined
        })
      )
    }
    const { nodes } = layoutAgentGraph(cards)
    for (const a of nodes) {
      for (const b of nodes) {
        if (a !== b) {
          expect(overlaps(a, b)).toBe(false)
        }
      }
    }
  })

  it('orders root trees by board bucket, attention first', () => {
    const layout = layoutAgentGraph([
      card('idle', { bucket: 'idle' }),
      card('ask', { bucket: 'attention' })
    ])
    expect(nodeById(layout.nodes, 'ask').y).toBeLessThan(nodeById(layout.nodes, 'idle').y)
  })
})
