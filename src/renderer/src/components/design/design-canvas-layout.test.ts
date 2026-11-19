import { describe, expect, it } from 'vitest'
import type { DesignCanvas, DesignGroup } from '../../../../shared/design-types'
import {
  DESIGN_GROUP_WIDTH,
  designGroupDepths,
  designHeightsApplied,
  estimateDesignGroupHeight,
  layoutDesignCanvas
} from './design-canvas-layout'

function group(id: string, position?: { x: number; y: number }): DesignGroup {
  return {
    id,
    title: id,
    blocks: [{ id: `${id}-b`, kind: 'action', title: 'b' }],
    ...(position ? { position } : {})
  }
}

function edge(from: string, to: string): DesignCanvas['edges'][number] {
  return { id: `${from}-${to}`, fromGroupId: from, toGroupId: to }
}

describe('designGroupDepths', () => {
  it('assigns BFS depth from groups without incoming edges', () => {
    const canvas: DesignCanvas = {
      groups: [group('a'), group('b'), group('c'), group('d')],
      edges: [edge('a', 'b'), edge('a', 'c'), edge('c', 'd'), edge('b', 'd')]
    }
    expect(Object.fromEntries(designGroupDepths(canvas))).toEqual({ a: 0, b: 1, c: 1, d: 2 })
  })

  it('still places groups that sit only on a cycle', () => {
    const canvas: DesignCanvas = {
      groups: [group('x'), group('y'), group('z')],
      edges: [edge('x', 'y'), edge('y', 'x'), edge('z', 'z')]
    }
    expect(Object.fromEntries(designGroupDepths(canvas))).toEqual({ x: 0, y: 1, z: 0 })
  })

  it('ignores edges to unknown groups', () => {
    const canvas: DesignCanvas = { groups: [group('a')], edges: [edge('ghost', 'a')] }
    expect(designGroupDepths(canvas).get('a')).toBe(0)
  })
})

describe('layoutDesignCanvas', () => {
  it('lays columns left to right and stacks rows within a column', () => {
    const canvas: DesignCanvas = {
      groups: [group('a'), group('b'), group('c')],
      edges: [edge('a', 'b'), edge('a', 'c')]
    }
    const positions = layoutDesignCanvas(canvas)
    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('b')?.x).toBeGreaterThan(DESIGN_GROUP_WIDTH)
    expect(positions.get('c')?.x).toBe(positions.get('b')?.x)
    expect(positions.get('c')?.y).toBeGreaterThan(estimateDesignGroupHeight(canvas.groups[1]))
  })

  it('keeps positions the agent chose', () => {
    const canvas: DesignCanvas = {
      groups: [group('a', { x: 500, y: -20 }), group('b')],
      edges: [edge('a', 'b')]
    }
    const positions = layoutDesignCanvas(canvas)
    expect(positions.get('a')).toEqual({ x: 500, y: -20 })
    expect(positions.get('b')?.y).toBe(0)
  })

  it('re-stacks a column with measured heights so tall cards do not overlap', () => {
    const canvas: DesignCanvas = {
      groups: [group('a'), group('b'), group('c'), group('pinned', { x: 0, y: 900 })],
      edges: [edge('a', 'b'), edge('a', 'c')]
    }
    const estimated = layoutDesignCanvas(canvas)
    const measured = layoutDesignCanvas(
      canvas,
      new Map([
        ['b', 400],
        ['pinned', 999]
      ])
    )
    const gap = (estimated.get('c')?.y ?? 0) - estimateDesignGroupHeight(canvas.groups[1])
    expect(measured.get('c')?.y).toBe(400 + gap)
    expect(measured.get('b')).toEqual(estimated.get('b'))
    expect(measured.get('pinned')).toEqual({ x: 0, y: 900 })
  })

  it('falls back to the estimate for groups not measured yet', () => {
    const canvas: DesignCanvas = {
      groups: [group('a'), group('b'), group('c')],
      edges: [edge('a', 'b'), edge('a', 'c')]
    }
    expect(layoutDesignCanvas(canvas, new Map())).toEqual(layoutDesignCanvas(canvas))
  })

  it('tells when the layout already used the measured heights', () => {
    const measured = new Map([['a', 120.2]])
    expect(designHeightsApplied(measured, null)).toBe(false)
    expect(designHeightsApplied(measured, new Map([['a', 120]]))).toBe(true)
    expect(designHeightsApplied(measured, new Map([['a', 90]]))).toBe(false)
    expect(designHeightsApplied(measured, new Map([['b', 120]]))).toBe(false)
  })
})
