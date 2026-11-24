import type { TerminalPaneLayoutNode } from '../../../../shared/terminal-tab-types'
import type { PaneManagerHost } from './pane-manager-host'
import type { ManagedPaneInternal } from './pane-manager-types'
import { applyDividerStyles, disposeDividersIn } from './pane-divider'
import { prepareMovedPanesForSplit } from './pane-split-close'
import { scheduleSplitScrollRestore } from './pane-split-scroll'
import { applyPaneFlexStyle } from './pane-tree-ops'
import { reattachWebglIfNeeded } from './pane-webgl-reattach'

// Why: DOM tags, not manager state, so the membership travels with the pane through moves.
const TEAM_LEADER_ATTR = 'agentTeamLeader'
const TEAM_SEQ_ATTR = 'agentTeamSeq'

let nextTeamSeq = 0

type LeafNode = Extract<TerminalPaneLayoutNode, { type: 'leaf' }>

function leaf(leafId: string): LeafNode {
  return { type: 'leaf', leafId }
}

function teammateRow(row: readonly string[]): TerminalPaneLayoutNode {
  return row.length === 1
    ? leaf(row[0])
    : {
        type: 'split',
        direction: 'vertical',
        first: leaf(row[0]),
        second: leaf(row[1]),
        ratio: 0.5
      }
}

/**
 * Leader keeps the left half; teammates share the right half equally — one column up to
 * three, two columns from four, and an odd last teammate spans its whole row.
 */
export function planAgentTeamLayout(
  leaderLeafId: string,
  teammateLeafIds: readonly string[]
): TerminalPaneLayoutNode {
  if (teammateLeafIds.length === 0) {
    return leaf(leaderLeafId)
  }
  const columns = teammateLeafIds.length <= 3 ? 1 : 2
  const rows: string[][] = []
  for (let index = 0; index < teammateLeafIds.length; index += columns) {
    rows.push(teammateLeafIds.slice(index, index + columns))
  }
  const stackRows = (start: number): TerminalPaneLayoutNode =>
    start === rows.length - 1
      ? teammateRow(rows[start])
      : {
          type: 'split',
          direction: 'horizontal',
          first: teammateRow(rows[start]),
          second: stackRows(start + 1),
          ratio: 1 / (rows.length - start)
        }
  return {
    type: 'split',
    direction: 'vertical',
    first: leaf(leaderLeafId),
    second: stackRows(0),
    ratio: 0.5
  }
}

function findPaneByLeafId(host: PaneManagerHost, leafId: string): ManagedPaneInternal | null {
  for (const pane of host.panes.values()) {
    if (pane.leafId === leafId) {
      return pane
    }
  }
  return null
}

function collectTeammates(host: PaneManagerHost, leaderLeafId: string): ManagedPaneInternal[] {
  return [...host.panes.values()]
    .filter((pane) => pane.container.dataset[TEAM_LEADER_ATTR] === leaderLeafId)
    .sort(
      (a, b) =>
        Number(a.container.dataset[TEAM_SEQ_ATTR]) - Number(b.container.dataset[TEAM_SEQ_ATTR])
    )
}

/** Smallest subtree holding exactly the team's panes, or null when it would sweep up others. */
function findTeamSubtree(
  host: PaneManagerHost,
  team: readonly ManagedPaneInternal[]
): HTMLElement | null {
  let node: HTMLElement | null = team[0].container
  while (node && !team.every((pane) => node!.contains(pane.container))) {
    node = node.parentElement
    if (node === host.root) {
      return null
    }
  }
  if (!node) {
    return null
  }
  const teamContainers = new Set(team.map((pane) => pane.container))
  const paneElements = node.querySelectorAll<HTMLElement>('.pane[data-pane-id]')
  for (const paneElement of paneElements) {
    if (!teamContainers.has(paneElement)) {
      return null
    }
  }
  return node
}

function buildSubtree(
  host: PaneManagerHost,
  node: TerminalPaneLayoutNode,
  panesByLeafId: ReadonlyMap<string, ManagedPaneInternal>
): HTMLElement {
  if (node.type === 'leaf') {
    const container = panesByLeafId.get(node.leafId)!.container
    applyPaneFlexStyle(container)
    return container
  }
  const isVertical = node.direction === 'vertical'
  const split = document.createElement('div')
  split.className = `pane-split ${isVertical ? 'is-vertical' : 'is-horizontal'}`
  split.style.display = 'flex'
  split.style.flexDirection = isVertical ? 'row' : 'column'
  split.style.minWidth = '0'
  split.style.minHeight = '0'
  const ratio = node.ratio ?? 0.5
  const first = buildSubtree(host, node.first, panesByLeafId)
  const second = buildSubtree(host, node.second, panesByLeafId)
  first.style.flex = `${ratio} 1 0%`
  second.style.flex = `${1 - ratio} 1 0%`
  split.append(first, host.createDivider(isVertical), second)
  return split
}

/** Rebuilds the leader's team subtree into the planned grid; leaves foreign layouts alone. */
export function arrangeAgentTeamPanes(host: PaneManagerHost, leaderLeafId: string): boolean {
  const leader = findPaneByLeafId(host, leaderLeafId)
  const teammates = collectTeammates(host, leaderLeafId)
  if (!leader || teammates.length === 0) {
    return false
  }
  const team = [leader, ...teammates]
  const subtree = findTeamSubtree(host, team)
  const parent = subtree?.parentElement
  if (!subtree || !parent) {
    return false
  }
  const slot = {
    flex: subtree.style.flex,
    minWidth: subtree.style.minWidth,
    minHeight: subtree.style.minHeight
  }
  const movedPaneStates = prepareMovedPanesForSplit(subtree, leader, host.panes)
  disposeDividersIn(subtree)
  const plan = planAgentTeamLayout(
    leaderLeafId,
    teammates.map((pane) => pane.leafId)
  )
  const panesByLeafId = new Map<string, ManagedPaneInternal>(
    team.map((pane) => [pane.leafId, pane])
  )
  const nextSubtree = buildSubtree(host, plan, panesByLeafId)
  if (parent === host.root) {
    nextSubtree.style.flex = ''
    nextSubtree.style.width = '100%'
    nextSubtree.style.height = '100%'
  } else {
    nextSubtree.style.flex = slot.flex || '1 1 0%'
    nextSubtree.style.minWidth = slot.minWidth || '0'
    nextSubtree.style.minHeight = slot.minHeight || '0'
  }
  parent.replaceChild(nextSubtree, subtree)
  applyDividerStyles(host.root, host.getStyleOptions())
  for (const moved of movedPaneStates) {
    scheduleSplitScrollRestore(
      (id) => host.panes.get(id),
      moved.pane.id,
      moved.scrollState,
      () => host.isDestroyed(),
      moved.hadWebgl ? reattachWebglIfNeeded : undefined
    )
  }
  host.options.onLayoutChanged?.()
  return true
}

/** Marks a pane as a teammate of `leaderLeafId` and re-balances the whole team. */
export function addAgentTeamPane(
  host: PaneManagerHost,
  paneId: number,
  leaderLeafId: string
): boolean {
  const pane = host.panes.get(paneId)
  if (!pane || pane.leafId === leaderLeafId) {
    return false
  }
  pane.container.dataset[TEAM_LEADER_ATTR] = leaderLeafId
  nextTeamSeq += 1
  pane.container.dataset[TEAM_SEQ_ATTR] = String(nextTeamSeq)
  return arrangeAgentTeamPanes(host, leaderLeafId)
}

/** The leader a pane belongs to as a teammate, read before the pane is torn down. */
export function readAgentTeamLeader(host: PaneManagerHost, paneId: number): string | null {
  return host.panes.get(paneId)?.container.dataset[TEAM_LEADER_ATTR] ?? null
}
