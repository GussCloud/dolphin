import { describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import type { TerminalLayoutSnapshot, TerminalTab } from '../../../../shared/terminal-tab-types'

const capability = vi.hoisted(() => ({ authoritative: true }))

vi.mock('../terminal/terminal-provider-snapshot-capability', () => ({
  terminalProviderHasAuthoritativeSnapshot: () => capability.authoritative
}))

import {
  isHibernatedTerminalTab,
  selectHibernatedTerminalTabIds,
  selectParkedHibernatedTerminalTabs
} from './hibernated-terminal-tabs'

const WORKTREE_ID = 'wt-1'
const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'

function record(
  leafId: string,
  overrides: Partial<SleepingAgentSessionRecord> = {}
): SleepingAgentSessionRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the predicate reads only these fields of the record.
  return {
    paneKey: `tab-h:${leafId}`,
    tabId: 'tab-h',
    worktreeId: WORKTREE_ID,
    state: 'done',
    origin: 'worktree-sleep',
    ...overrides
  } as SleepingAgentSessionRecord
}

function layout(leafIds: string[]): TerminalLayoutSnapshot {
  const root =
    leafIds.length === 1
      ? { type: 'leaf' as const, leafId: leafIds[0] }
      : {
          type: 'split' as const,
          direction: 'vertical' as const,
          first: { type: 'leaf' as const, leafId: leafIds[0] },
          second: { type: 'leaf' as const, leafId: leafIds[1] }
        }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the predicate reads only root and ptyIdsByLeafId.
  return {
    root,
    activeLeafId: leafIds[0],
    expandedLeafId: null,
    ptyIdsByLeafId: Object.fromEntries(leafIds.map((id) => [id, `${WORKTREE_ID}@@pty-${id}`]))
  } as TerminalLayoutSnapshot
}

function hibernatedState(leafIds = [LEAF_A]) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: fixture tab carries the fields the predicate reads.
  const tab = { id: 'tab-h', ptyId: null, worktreeId: WORKTREE_ID } as TerminalTab
  const ptyIdsByTabId: Record<string, string[]> = { 'tab-h': [] }
  return {
    tabsByWorktree: { [WORKTREE_ID]: [tab] },
    ptyIdsByTabId,
    terminalLayoutsByTabId: { 'tab-h': layout(leafIds) },
    sleepingAgentSessionsByPaneKey: Object.fromEntries(
      leafIds.map((leafId) => [`tab-h:${leafId}`, record(leafId)])
    )
  }
}

describe('isHibernatedTerminalTab', () => {
  it('recognizes a tab whose every pane holds a passive hibernation record over a daemon binding', () => {
    const state = hibernatedState([LEAF_A, LEAF_B])
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(true)
    expect(selectHibernatedTerminalTabIds(state, WORKTREE_ID)).toEqual(new Set(['tab-h']))
  })

  it('rejects a tab that still has a live PTY', () => {
    const state = hibernatedState()
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: 'wt-1@@live' })).toBe(
      false
    )
    state.ptyIdsByTabId['tab-h'] = ['wt-1@@live']
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(false)
  })

  it('rejects a split whose sibling pane has no hibernation record', () => {
    const state = hibernatedState([LEAF_A, LEAF_B])
    delete state.sleepingAgentSessionsByPaneKey[`tab-h:${LEAF_B}`]
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(false)
  })

  it('rejects resumable (non-passive) records, which must stay mounted to cold-restore', () => {
    const state = hibernatedState()
    state.sleepingAgentSessionsByPaneKey[`tab-h:${LEAF_A}`] = record(LEAF_A, { state: 'working' })
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(false)
  })

  it('rejects bindings a remount cannot replay from the local daemon checkpoint', () => {
    const state = hibernatedState()
    const ptyIdsByLeafId = state.terminalLayoutsByTabId['tab-h'].ptyIdsByLeafId!
    ptyIdsByLeafId[LEAF_A] = 'fail-open-pty'
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(false)
    ptyIdsByLeafId[LEAF_A] = 'other-worktree@@pty'
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(false)
    ptyIdsByLeafId[LEAF_A] = `${WORKTREE_ID}@@pty`
    capability.authoritative = false
    expect(isHibernatedTerminalTab(state, WORKTREE_ID, { id: 'tab-h', ptyId: null })).toBe(false)
    capability.authoritative = true
  })
})

describe('selectParkedHibernatedTerminalTabs', () => {
  const base = {
    hibernatedTabIds: new Set(['tab-h']),
    wakeRequestedTabIds: new Set<string>(),
    parkingEnabled: true,
    nowMs: 100_000,
    coldParkDelayMs: 30_000
  }
  const hidden = {
    id: 'tab-h',
    isVisible: false,
    hasActivityTerminalPortal: false,
    hiddenSinceMs: 70_000
  }

  it('parks a hidden hibernated tab at the cold-park delay with no hot-retain', () => {
    expect(selectParkedHibernatedTerminalTabs({ ...base, candidates: [hidden] })).toEqual(
      new Set(['tab-h'])
    )
    expect(
      selectParkedHibernatedTerminalTabs({
        ...base,
        candidates: [{ ...hidden, hiddenSinceMs: 70_001 }]
      }).size
    ).toBe(0)
  })

  it('never parks visible, portal-hosted, wake-requested, or non-hibernated tabs', () => {
    for (const candidate of [
      { ...hidden, isVisible: true },
      { ...hidden, hasActivityTerminalPortal: true },
      { ...hidden, id: 'tab-live' }
    ]) {
      expect(selectParkedHibernatedTerminalTabs({ ...base, candidates: [candidate] }).size).toBe(0)
    }
    expect(
      selectParkedHibernatedTerminalTabs({
        ...base,
        candidates: [hidden],
        wakeRequestedTabIds: new Set(['tab-h'])
      }).size
    ).toBe(0)
    expect(
      selectParkedHibernatedTerminalTabs({ ...base, candidates: [hidden], parkingEnabled: false })
        .size
    ).toBe(0)
  })
})
