import { describe, expect, it } from 'vitest'
import { buildDashboardSnapshot, type DashboardSnapshotState } from './build-dashboard-snapshot'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'

const NOW = 1_000_000_000
const TAB_ID = 'tab1'
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const CHILD_LEAF_ID = '33333333-3333-4333-8333-333333333333'
const PANE_KEY = makePaneKey(TAB_ID, LEAF_ID)
const CHILD_PANE_KEY = makePaneKey(TAB_ID, CHILD_LEAF_ID)

function entry(overrides: Partial<AgentStatusEntry>): AgentStatusEntry {
  return {
    paneKey: PANE_KEY,
    state: 'working',
    prompt: 'do the thing',
    updatedAt: NOW,
    stateStartedAt: NOW - 5000,
    stateHistory: [],
    agentType: 'claude',
    tabId: TAB_ID,
    worktreeId: 'w1',
    ...overrides
  }
}

function tab(): TerminalTab {
  return {
    id: TAB_ID,
    ptyId: 'pty1',
    worktreeId: 'w1',
    title: 'agent',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: NOW
  }
}

function worktree(): Worktree {
  return {
    id: 'w1',
    repoId: 'r1',
    path: '/r1/w1',
    head: 'abc123',
    branch: 'main',
    isBare: false,
    isMainWorktree: false,
    displayName: 'wt-one',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: NOW
  }
}

function baseState(overrides: Partial<DashboardSnapshotState>): DashboardSnapshotState {
  const state = {
    repos: [{ id: 'r1', path: '/r1', displayName: 'Repo One', badgeColor: '#000' }],
    worktreesByRepo: { r1: [worktree()] },
    tabsByWorktree: { w1: [tab()] },
    agentStatusByPaneKey: {},
    retainedAgentsByPaneKey: {},
    migrationUnsupportedByPtyId: {},
    runtimeAgentOrchestrationByPaneKey: {},
    terminalLayoutsByTabId: {},
    ptyIdsByTabId: {},
    runtimePaneTitlesByTabId: {},
    acknowledgedAgentsByPaneKey: {},
    ...overrides
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder only reads the slices seeded above; the rest of AppState is irrelevant here.
  return state as unknown as DashboardSnapshotState
}

describe('buildDashboardSnapshot with Claude Agent Teams', () => {
  it('nests Claude Agent Teams teammates under their lead and names them', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: {
          [PANE_KEY]: entry({ paneKey: PANE_KEY }),
          [CHILD_PANE_KEY]: entry({ paneKey: CHILD_PANE_KEY })
        },
        runtimeAgentTeamLineageByPaneKey: {
          [CHILD_PANE_KEY]: { leaderPaneKey: PANE_KEY, teammateName: 'primos' },
          // A self-link must never make a pane its own parent.
          [PANE_KEY]: { leaderPaneKey: PANE_KEY }
        },
        terminalLayoutsByTabId: {
          [TAB_ID]: {
            root: { type: 'leaf', leafId: LEAF_ID },
            activeLeafId: LEAF_ID,
            expandedLeafId: null,
            ptyIdsByLeafId: { [LEAF_ID]: 'pty1', [CHILD_LEAF_ID]: 'pty-child' }
          }
        },
        ptyIdsByTabId: { [TAB_ID]: ['pty1', 'pty-child'] }
      }),
      NOW
    )

    const lead = snapshot.cards.find((card) => card.paneKey === PANE_KEY)
    const mate = snapshot.cards.find((card) => card.paneKey === CHILD_PANE_KEY)
    expect(lead?.parentPaneKey).toBeUndefined()
    expect(mate).toMatchObject({ parentPaneKey: PANE_KEY, conversationName: 'primos' })
  })
})
