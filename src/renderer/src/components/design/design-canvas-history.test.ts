import { describe, expect, it } from 'vitest'
import type { Design, DesignCanvasVersion, DesignEvent } from '../../../../shared/design-types'
import { designApprovedVersion, designCanvasView } from './design-canvas-history'

function version(n: number, at: number): DesignCanvasVersion {
  return { version: n, at, canvas: { groups: [], edges: [] } }
}

function move(detail: string, at: number): DesignEvent {
  return { kind: 'status-changed', actor: 'user', at, detail }
}

const VERSIONS = [version(1, 10), version(2, 20), version(3, 30)]

function design(
  overrides: Partial<Pick<Design, 'status' | 'inbox' | 'events'>>
): Pick<Design, 'status' | 'inbox' | 'events' | 'canvasVersions'> {
  return { status: 'in-progress', inbox: [], events: [], canvasVersions: VERSIONS, ...overrides }
}

describe('designApprovedVersion', () => {
  it('reads the version from the approval notice', () => {
    const approved = design({
      inbox: [{ id: 'i1', kind: 'status', refId: 'in-progress', canvasVersion: 2, createdAt: 25 }],
      events: [move('draft -> in-progress', 25)]
    })
    expect(designApprovedVersion(approved)).toBe(2)
  })

  it('falls back to the canvas drawn before the approval when the notice is gone', () => {
    expect(designApprovedVersion(design({ events: [move('draft -> in-progress', 25)] }))).toBe(2)
    // Done through the completion confirm keeps the approval.
    expect(
      designApprovedVersion(design({ status: 'done', events: [move('draft -> in-progress', 35)] }))
    ).toBe(3)
  })

  it('has no approval while planning, before any approval, or after a move back to draft', () => {
    expect(designApprovedVersion(design({ status: 'draft' }))).toBeNull()
    expect(designApprovedVersion(design({ status: 'discarded' }))).toBeNull()
    const voided = design({
      status: 'discarded',
      inbox: [{ id: 'i1', kind: 'status', refId: 'in-progress', canvasVersion: 1, createdAt: 15 }],
      events: [
        move('draft -> in-progress', 15),
        move('in-progress -> draft', 18),
        move('draft -> discarded', 40)
      ]
    })
    expect(designApprovedVersion(voided)).toBeNull()
  })

  it('takes the newest approval after a reopen', () => {
    const reapproved = design({
      events: [
        move('draft -> in-progress', 15),
        move('in-progress -> draft', 18),
        move('draft -> in-progress', 32)
      ],
      inbox: [{ id: 'i1', kind: 'status', refId: 'in-progress', canvasVersion: 1, createdAt: 15 }]
    })
    expect(designApprovedVersion(reapproved)).toBe(3)
  })
})

describe('designCanvasView', () => {
  it('follows the current version unless an older kept one is picked', () => {
    expect(designCanvasView(VERSIONS, null)).toMatchObject({
      shown: { version: 3 },
      historical: false
    })
    expect(designCanvasView(VERSIONS, 1)).toMatchObject({
      shown: { version: 1 },
      current: { version: 3 },
      historical: true
    })
  })

  it('returns to the current version when the picked one aged out', () => {
    expect(designCanvasView(VERSIONS, 99)).toMatchObject({
      shown: { version: 3 },
      historical: false
    })
  })

  it('has nothing to show before the first canvas', () => {
    expect(designCanvasView([], null)).toBeNull()
  })
})
