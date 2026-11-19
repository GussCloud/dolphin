import { describe, expect, it } from 'vitest'
import type { Design, DesignEvent } from '../../../../shared/design-types'
import { designEventDetail } from './design-event-detail'

const design: Pick<Design, 'decisions' | 'messages' | 'canvasVersions'> = {
  decisions: [
    {
      id: 'd1',
      question: 'How long is a code valid?',
      options: [],
      multiSelect: false,
      askedAt: 1
    },
    { id: 'd2', question: 'Which channels?', options: [], multiSelect: true, askedAt: 1 }
  ],
  messages: [{ id: 'm1', author: 'user', text: 'Can devices skip the code?', at: 1 }],
  canvasVersions: [
    {
      version: 1,
      at: 1,
      canvas: {
        groups: [
          { id: 'g', title: 'G', blocks: [{ id: 'b1', kind: 'screen', title: 'Code screen' }] }
        ],
        edges: []
      }
    }
  ]
}

function detail(kind: DesignEvent['kind'], value: string | undefined): string | null {
  return designEventDetail(
    { kind, at: 1, actor: 'agent', ...(value ? { detail: value } : {}) },
    design
  )
}

describe('designEventDetail', () => {
  it('turns host shapes into readable text from the design data', () => {
    expect(detail('canvas-set', 'v3')).toBe('Version 3')
    expect(detail('status-changed', 'draft -> in-progress')).toBe(
      'Draft → In progress · version 1 approved'
    )
    expect(detail('status-changed', 'in-progress -> discarded')).toBe('In progress → Discarded')
    expect(detail('completion-requested', 'v4')).toBe('Version 4')
    expect(detail('completion-confirmed', 'in-progress -> done')).toBe('In progress → Done')
    expect(detail('completion-declined', 'm1')).toBe('Asked for: "Can devices skip the code?"')
    expect(detail('decision-asked', 'd1,d2')).toBe('How long is a code valid? · Which channels?')
    expect(detail('decision-answered', 'd2')).toBe('Which channels?')
    expect(detail('comment-added', 'b1')).toBe('On Code screen')
    expect(detail('comment-added', 'design')).toBe('On the whole design')
    expect(detail('agent-replied', 'm1')).toBe('Reply to "Can devices skip the code?"')
    expect(detail('inbox-acked', 'i1,i2,i3')).toBe('Items read: 3')
    expect(detail('inbox-nudged', '2')).toBe('Notice 2')
    expect(detail('delivery-blocked', '3 nudges unacked')).toBe('Unread notices: 3')
    expect(detail('agent-bound', 'rebound')).toBe('Moved to a new terminal')
  })

  it('names no approved version when nothing was drawn before the approval', () => {
    expect(
      designEventDetail(
        { kind: 'status-changed', at: 0, actor: 'user', detail: 'draft -> in-progress' },
        design
      )
    ).toBe('Draft → In progress')
  })

  it('counts asked decisions it can no longer find', () => {
    expect(detail('decision-asked', 'd1,gone')).toBe('2 decisions')
  })

  it('falls back to the raw detail for shapes it does not know', () => {
    expect(detail('decision-asked', '2 decisions')).toBe('2 decisions')
    expect(detail('status-changed', 'draft -> archived')).toBe('draft -> archived')
    expect(detail('canvas-set', 'latest')).toBe('latest')
    expect(detail('decision-answered', 'unknown')).toBe('unknown')
    expect(detail('renamed', 'Old name')).toBe('Old name')
    expect(detail('completion-declined', 'gone')).toBe('gone')
  })

  it('shows nothing without a detail', () => {
    expect(detail('created', undefined)).toBeNull()
  })
})
