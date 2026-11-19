import { describe, expect, it } from 'vitest'
import type { DesignCanvas, DesignGroup } from '../../../../shared/design-types'
import {
  DESIGN_GROUP_WIDTH,
  designGroupDepths,
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
})
