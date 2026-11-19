import { describe, expect, it } from 'vitest'
import type { DesignListEntry, DesignStatus } from '../../../../shared/design-types'
import {
  countDesignListFilters,
  DEFAULT_DESIGN_LIST_FILTER,
  designFilterWindow,
  filterDesignList,
  parseLocalDay,
  toggleDesignStatusFilter
} from './design-list-view'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 10, 19, 12, 0, 0).getTime()

function entry(id: string, status: DesignStatus, updatedAt: number): DesignListEntry {
  return {
    id,
    name: id,
    request: 'r',
    status,
    agent: 'claude',
    repoId: null,
    worktreeId: null,
    paneKey: null,
    createdAt: updatedAt,
    updatedAt,
    canvasVersion: null,
    groupCount: 0
  }
}

describe('filterDesignList', () => {
  const designs = [
    entry('old-draft', 'draft', NOW - 40 * DAY),
    entry('new-draft', 'draft', NOW - DAY),
    entry('progress', 'in-progress', NOW - 2 * DAY),
    entry('done', 'done', NOW - 3 * DAY),
    entry('discarded', 'discarded', NOW - 4 * DAY)
  ]

  it('shows only drafts by default, newest first', () => {
    expect(filterDesignList(designs, DEFAULT_DESIGN_LIST_FILTER, NOW).map((d) => d.id)).toEqual([
      'new-draft',
      'old-draft'
    ])
  })

  it('matches nothing when no status is selected', () => {
    expect(filterDesignList(designs, { ...DEFAULT_DESIGN_LIST_FILTER, statuses: [] }, NOW)).toEqual(
      []
    )
  })

  it('applies a period preset on updatedAt', () => {
    const filter = { ...DEFAULT_DESIGN_LIST_FILTER, period: '30d' as const }
    expect(filterDesignList(designs, filter, NOW).map((d) => d.id)).toEqual(['new-draft'])
  })

  it('treats from/to as inclusive local days', () => {
    const statuses: DesignStatus[] = ['in-progress', 'done', 'discarded']
    const filter = {
      ...DEFAULT_DESIGN_LIST_FILTER,
      statuses,
      from: '2026-11-15',
      to: '2026-11-16'
    }
    // NOW-3d = Nov 16 12:00, NOW-4d = Nov 15 12:00, NOW-2d = Nov 17 12:00
    expect(filterDesignList(designs, filter, NOW).map((d) => d.id)).toEqual(['done', 'discarded'])
  })

  it('combines a preset and a from date with the tighter lower bound', () => {
    const fromMs = parseLocalDay('2026-11-01')
    const window = designFilterWindow(
      { ...DEFAULT_DESIGN_LIST_FILTER, period: '7d', from: '2026-11-01' },
      NOW
    )
    expect(window.min).toBe(NOW - 7 * DAY)
    expect(fromMs).not.toBeNull()
    expect(window.max).toBeNull()
  })
})

describe('parseLocalDay', () => {
  it('rejects malformed and impossible dates', () => {
    expect(parseLocalDay(null)).toBeNull()
    expect(parseLocalDay('')).toBeNull()
    expect(parseLocalDay('2026-02-30')).toBeNull()
    expect(parseLocalDay('26-1-1')).toBeNull()
    expect(parseLocalDay('2026-11-19')).toBe(new Date(2026, 10, 19).getTime())
  })
})

describe('countDesignListFilters', () => {
  it('counts only what differs from the default', () => {
    expect(countDesignListFilters(DEFAULT_DESIGN_LIST_FILTER)).toBe(0)
    const withDone = toggleDesignStatusFilter(DEFAULT_DESIGN_LIST_FILTER, 'done')
    expect(withDone.statuses).toEqual(['draft', 'done'])
    expect(countDesignListFilters({ ...withDone, period: '7d', to: '2026-11-19' })).toBe(3)
    expect(toggleDesignStatusFilter(withDone, 'draft').statuses).toEqual(['done'])
  })
})
