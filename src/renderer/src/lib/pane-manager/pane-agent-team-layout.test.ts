// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { TerminalPaneLayoutNode } from '../../../../shared/terminal-tab-types'
import type { PaneManagerHost } from './pane-manager-host'
import type { ManagedPaneInternal } from './pane-manager-types'

vi.mock('./pane-split-close', () => ({ prepareMovedPanesForSplit: () => [] }))
vi.mock('./pane-split-scroll', () => ({ scheduleSplitScrollRestore: vi.fn() }))
vi.mock('./pane-webgl-reattach', () => ({ reattachWebglIfNeeded: vi.fn() }))
vi.mock('./pane-divider', () => ({
  applyDividerStyles: vi.fn(),
  createDivider: vi.fn(),
  disposeDivider: vi.fn(),
  disposeDividersIn: vi.fn()
}))

import {
  addAgentTeamPane,
  arrangeAgentTeamPanes,
  planAgentTeamLayout
} from './pane-agent-team-layout'
import { detachPaneFromTree, wrapInSplit } from './pane-tree-ops'

type Rect = { x: number; y: number; w: number; h: number }

const round = (value: number): number => Math.round(value * 1000) / 1000
const roundRect = (rect: Rect): Rect => ({
  x: round(rect.x),
  y: round(rect.y),
  w: round(rect.w),
  h: round(rect.h)
})

/** Independent statement of the rule: leader left half, teammates in a 1- or 2-column grid. */
function expectedTeammateRects(count: number): Rect[] {
  const columns = count <= 3 ? 1 : 2
  const rows = Math.ceil(count / columns)
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns)
    const spansRow = columns === 2 && count % 2 === 1 && index === count - 1
    const width = spansRow ? 0.5 : 0.5 / columns
    return roundRect({ x: 0.5 + (index % columns) * width, y: row / rows, w: width, h: 1 / rows })
  })
}

function planRects(node: TerminalPaneLayoutNode, rect: Rect, out: Map<string, Rect>): void {
  if (node.type === 'leaf') {
    out.set(node.leafId, roundRect(rect))
    return
  }
  const ratio = node.ratio ?? 0.5
  if (node.direction === 'vertical') {
    planRects(node.first, { ...rect, w: rect.w * ratio }, out)
    planRects(node.second, { ...rect, x: rect.x + rect.w * ratio, w: rect.w * (1 - ratio) }, out)
  } else {
    planRects(node.first, { ...rect, h: rect.h * ratio }, out)
    planRects(node.second, { ...rect, y: rect.y + rect.h * ratio, h: rect.h * (1 - ratio) }, out)
  }
}

/** Reads each pane's share of the root from the flex weights the DOM actually carries. */
function domRects(el: HTMLElement, rect: Rect, out: Map<string, Rect>): void {
  if (el.classList.contains('pane')) {
    out.set(el.dataset.leafId!, roundRect(rect))
    return
  }
  const children = Array.from(el.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      (child.classList.contains('pane') || child.classList.contains('pane-split'))
  )
  const grows = children.map((child) => Number.parseFloat(child.style.flex) || 1)
  const total = grows.reduce((sum, grow) => sum + grow, 0)
  const vertical = el.classList.contains('is-vertical')
  let offset = 0
  children.forEach((child, index) => {
    const share = grows[index] / total
    domRects(
      child,
      vertical
        ? { x: rect.x + rect.w * offset, y: rect.y, w: rect.w * share, h: rect.h }
        : { x: rect.x, y: rect.y + rect.h * offset, w: rect.w, h: rect.h * share },
      out
    )
    offset += share
  })
}

function createHarness() {
  const root = document.createElement('div')
  const panes = new Map<number, ManagedPaneInternal>()
  let nextId = 1
  const createPane = (leafId: string): ManagedPaneInternal => {
    const container = document.createElement('div')
    container.className = 'pane'
    container.dataset.paneId = String(nextId)
    container.dataset.leafId = leafId
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the layout code reads only id, leafId and container.
    const pane = { id: nextId, leafId, container } as unknown as ManagedPaneInternal
    panes.set(nextId, pane)
    nextId += 1
    return pane
  }
  const divider = (isVertical: boolean): HTMLElement => {
    const el = document.createElement('div')
    el.className = `pane-divider ${isVertical ? 'is-vertical' : 'is-horizontal'}`
    return el
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: arrange touches only these host members.
  const host = {
    root,
    panes,
    options: { onLayoutChanged: vi.fn() },
    getStyleOptions: () => ({}),
    isDestroyed: () => false,
    createDivider: divider
  } as unknown as PaneManagerHost
  const leader = createPane('leader')
  leader.container.style.width = '100%'
  leader.container.style.height = '100%'
  root.appendChild(leader.container)
  /** Mirrors the shim's main-vertical splits: right of the leader, then below the last teammate. */
  const splitTeammate = (from: ManagedPaneInternal, isVertical: boolean, leafId: string) => {
    const pane = createPane(leafId)
    wrapInSplit(from.container, pane.container, isVertical, divider(isVertical))
    return pane
  }
  const rects = (): Map<string, Rect> => {
    const out = new Map<string, Rect>()
    const top = root.firstElementChild
    if (top instanceof HTMLElement) {
      domRects(top, { x: 0, y: 0, w: 1, h: 1 }, out)
    }
    return out
  }
  return { root, host, leader, panes, splitTeammate, rects }
}

describe('planAgentTeamLayout', () => {
  it.each([1, 2, 3, 4, 5, 6])('gives %i teammate(s) equal parts of the right half', (count) => {
    const teammates = Array.from({ length: count }, (_, index) => `t${index + 1}`)
    const rects = new Map<string, Rect>()
    planRects(planAgentTeamLayout('leader', teammates), { x: 0, y: 0, w: 1, h: 1 }, rects)
    expect(rects.get('leader')).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
    expect(teammates.map((id) => rects.get(id))).toEqual(expectedTeammateRects(count))
  })
})

describe('addAgentTeamPane', () => {
  it('re-balances the team after every teammate split instead of halving the last pane', () => {
    const harness = createHarness()
    let last = harness.leader
    for (let count = 1; count <= 6; count += 1) {
      last = harness.splitTeammate(last, count === 1, `t${count}`)
      expect(addAgentTeamPane(harness.host, last.id, 'leader')).toBe(true)
      const rects = harness.rects()
      const teammates = Array.from({ length: count }, (_, index) => rects.get(`t${index + 1}`))
      expect(rects.get('leader')).toEqual({ x: 0, y: 0, w: 0.5, h: 1 })
      expect(teammates).toEqual(expectedTeammateRects(count))
    }
    expect(harness.root.querySelectorAll('.pane').length).toBe(7)
  })

  it('re-balances the remaining teammates after one is removed', () => {
    const harness = createHarness()
    let last = harness.leader
    for (let count = 1; count <= 4; count += 1) {
      last = harness.splitTeammate(last, count === 1, `t${count}`)
      addAgentTeamPane(harness.host, last.id, 'leader')
    }
    const removed = [...harness.panes.values()].find((pane) => pane.leafId === 't2')!
    detachPaneFromTree(removed, {
      getRoot: () => harness.root,
      getStyleOptions: () => ({}),
      safeFit: vi.fn(),
      refitPanesUnder: vi.fn()
    })
    harness.panes.delete(removed.id)
    expect(arrangeAgentTeamPanes(harness.host, 'leader')).toBe(true)
    const rects = harness.rects()
    expect(['t1', 't3', 't4'].map((id) => rects.get(id))).toEqual(expectedTeammateRects(3))
  })

  it('leaves the layout alone when the team shares its subtree with an unrelated pane', () => {
    const harness = createHarness()
    const teammate = harness.splitTeammate(harness.leader, true, 't1')
    harness.splitTeammate(teammate, false, 'user-pane')
    const second = harness.splitTeammate(teammate, false, 't2')
    harness.root.firstElementChild!.setAttribute('data-marker', 'kept')
    addAgentTeamPane(harness.host, teammate.id, 'leader')
    expect(addAgentTeamPane(harness.host, second.id, 'leader')).toBe(false)
    expect(harness.root.firstElementChild!.getAttribute('data-marker')).toBe('kept')
  })
})
