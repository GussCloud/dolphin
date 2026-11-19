import { describe, expect, it } from 'vitest'
import type { DesignCanvas } from '../../../../shared/design-types'
import {
  designBlockSourceHandle,
  designCanvasToFlow,
  DESIGN_BACK_EDGE_TYPE,
  DESIGN_GROUP_SOURCE_HANDLE,
  DESIGN_GROUP_TARGET_HANDLE
} from './design-canvas-flow'

const canvas: DesignCanvas = {
  groups: [
    {
      id: 'start',
      title: 'Start',
      blocks: [
        { id: 'login', kind: 'screen', title: 'Login' },
        { id: 'check', kind: 'decision', title: 'Valid?' }
      ]
    },
    { id: 'home', title: 'Home', blocks: [] },
    { id: 'error', title: 'Error', blocks: [] }
  ],
  edges: [
    { id: 'e1', fromGroupId: 'start', fromBlockId: 'check', toGroupId: 'home', label: 'yes' },
    { id: 'e2', fromGroupId: 'start', toGroupId: 'error' },
    { id: 'bad-group', fromGroupId: 'start', toGroupId: 'missing' },
    { id: 'back', fromGroupId: 'error', toGroupId: 'start', label: 'retry' },
    { id: 'bad-block', fromGroupId: 'home', fromBlockId: 'login', toGroupId: 'error' }
  ]
}

describe('designCanvasToFlow', () => {
  it('maps groups to nodes with the handles their edges need', () => {
    const { nodes } = designCanvasToFlow(canvas)
    const start = nodes.find((node) => node.id === 'start')
    expect(start?.type).toBe('designGroup')
    expect(start?.data.sourceBlockIds).toEqual(['check'])
    expect(start?.data.hasGroupSource).toBe(true)
    expect(start?.data.hasIncoming).toBe(true)
    expect(nodes.find((node) => node.id === 'home')?.data.hasIncoming).toBe(true)
  })

  it('maps edges to block or group handles and drops edges off the canvas', () => {
    const { edges } = designCanvasToFlow(canvas)
    expect(edges.map((edge) => edge.id)).toEqual(['e1', 'e2', 'back'])
    expect(edges[0]).toMatchObject({
      source: 'start',
      sourceHandle: designBlockSourceHandle('check'),
      target: 'home',
      targetHandle: DESIGN_GROUP_TARGET_HANDLE,
      label: 'yes'
    })
    expect(edges[1].sourceHandle).toBe(DESIGN_GROUP_SOURCE_HANDLE)
    expect(edges[1]).not.toHaveProperty('label')
  })

  it('marks edges into a card at or left of the source as back-edges', () => {
    const { edges } = designCanvasToFlow(canvas)
    expect(edges.find((edge) => edge.id === 'e1')?.type).toBe('smoothstep')
    expect(edges.find((edge) => edge.id === 'back')?.type).toBe(DESIGN_BACK_EDGE_TYPE)
  })
})
