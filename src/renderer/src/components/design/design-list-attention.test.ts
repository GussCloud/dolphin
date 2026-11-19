import { describe, expect, it } from 'vitest'
import type { DesignListEntry, DesignStatus } from '../../../../shared/design-types'
import { designListAttention, revealDesignsInFilter } from './design-list-attention'
import { DEFAULT_DESIGN_LIST_FILTER, filterDesignList } from './design-list-view'

const NOW = new Date(2026, 10, 19, 12, 0, 0).getTime()
const DAY = 24 * 60 * 60 * 1000

function entry(
  id: string,
  status: DesignStatus,
  extra: Partial<DesignListEntry> = {}
): DesignListEntry {
  return {
    id,
    name: id,
    request: 'r',
    status,
    agent: 'claude',
    repoId: null,
    worktreeId: null,
    paneKey: null,
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    canvasVersion: 1,
    groupCount: 1,
    openDecisionCount: 0,
    deliveryBlocked: false,
    completionPending: false,
    ...extra
  }
}

describe('designListAttention', () => {
  it('counts hidden designs per reason the user is needed', () => {
    const attention = designListAttention(
      [
        entry('shown-draft', 'draft', { openDecisionCount: 2 }),
        entry('waiting', 'in-progress', { completionPending: true }),
        entry('asking', 'in-progress', { openDecisionCount: 1, deliveryBlocked: true }),
        entry('quiet', 'in-progress')
      ],
      DEFAULT_DESIGN_LIST_FILTER,
      NOW
    )
    expect(attention).toMatchObject({ completion: 1, decisions: 1, blocked: 1 })
    expect(attention?.hidden.map((design) => design.id)).toEqual(['waiting', 'asking'])
  })

  it('ignores closed designs and designs the filter already shows', () => {
    expect(
      designListAttention(
        [
          entry('draft', 'draft', { openDecisionCount: 1 }),
          entry('done', 'done', { deliveryBlocked: true }),
          entry('gone', 'discarded', { openDecisionCount: 1 })
        ],
        DEFAULT_DESIGN_LIST_FILTER,
        NOW
      )
    ).toBeNull()
  })
})

describe('revealDesignsInFilter', () => {
  it('adds only the statuses the hidden designs need', () => {
    const hidden = [entry('waiting', 'in-progress', { completionPending: true })]
    const revealed = revealDesignsInFilter(DEFAULT_DESIGN_LIST_FILTER, hidden, NOW)
    expect(revealed.statuses).toEqual(['draft', 'in-progress'])
    expect(revealed.period).toBe('all')
  })

  it('opens the dates when they also hid a design', () => {
    const old = entry('old', 'draft', { openDecisionCount: 1, updatedAt: NOW - 60 * DAY })
    const filter = { ...DEFAULT_DESIGN_LIST_FILTER, period: '7d' as const }
    const attention = designListAttention([old], filter, NOW)
    expect(attention?.hidden).toHaveLength(1)
    const revealed = revealDesignsInFilter(filter, attention?.hidden ?? [], NOW)
    expect(filterDesignList([old], revealed, NOW).map((design) => design.id)).toEqual(['old'])
    expect(revealed.period).toBe('all')
  })
})
