import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry, AgentStatusState } from '../../../../shared/agent-status-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import type { Worktree } from '../../../../shared/worktree/types'
import type { DashboardSnapshotState } from '@/components/dashboard/build-dashboard-snapshot'
import { buildNeedsYouRows, createNeedsYouRowsCache } from './needs-you-rows'

const NOW = 1_000_000_000
const LEAF_1 = '11111111-1111-4111-8111-111111111111'
const LEAF_2 = '22222222-2222-4222-8222-222222222222'
const LEAF_3 = '33333333-3333-4333-8333-333333333333'
const PANE_1 = makePaneKey('tab1', LEAF_1)
const PANE_2 = makePaneKey('tab2', LEAF_2)
const PANE_3 = makePaneKey('tab3', LEAF_3)
const FOLDER_ID = folderWorkspaceKey('f1')

function worktree(id: string): Worktree {
  return {
    id,
    repoId: 'r1',
    path: `/r1/${id}`,
    head: 'abc123',
    branch: `refs/heads/feature-${id}`,
    isBare: false,
    isMainWorktree: false,
    displayName: `Workspace ${id}`,
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

function folder(): FolderWorkspace {
  return {
    id: 'f1',
    projectGroupId: null,
    name: 'Notes folder',
    folderPath: '/notes',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  }
}

function tab(id: string, worktreeId: string): TerminalTab {
  return {
    id,
    ptyId: `pty-${id}`,
    worktreeId,
    title: 'shell',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: NOW
  }
}

function entry(
  paneKey: string,
  tabId: string,
  worktreeId: string,
  state: AgentStatusState,
  stateStartedAt: number,
  extra: Partial<AgentStatusEntry> = {}
): AgentStatusEntry {
  return {
    paneKey,
    state,
    prompt: 'do the thing',
    updatedAt: NOW,
    stateStartedAt,
    stateHistory: [],
    agentType: 'claude',
    tabId,
    worktreeId,
    ...extra
  }
}

function layout(leafId: string, ptyId: string) {
  return {
    root: { type: 'leaf' as const, leafId },
    activeLeafId: leafId,
    expandedLeafId: null,
    ptyIdsByLeafId: { [leafId]: ptyId }
  }
}

const QUESTION_JSON = JSON.stringify({
  questions: [
    {
      question: 'Which database should I use?',
      header: 'DB',
      multiSelect: false,
      options: [{ label: 'Postgres' }, { label: 'SQLite' }]
    }
  ]
})

function baseState(states: {
  pane1: AgentStatusState
  pane2: AgentStatusState
  pane3: AgentStatusState
}): DashboardSnapshotState {
  return {
    repos: [{ id: 'r1', path: '/r1', displayName: 'Repo One', badgeColor: '#000', addedAt: 1 }],
    worktreesByRepo: { r1: [worktree('w1'), worktree('w2')] },
    folderWorkspaces: [folder()],
    tabsByWorktree: {
      w1: [tab('tab1', 'w1')],
      w2: [tab('tab2', 'w2')],
      [FOLDER_ID]: [tab('tab3', FOLDER_ID)]
    },
    agentStatusByPaneKey: {
      // Newest attention row first in insertion order, so the sort is what puts it last.
      [PANE_1]: entry(PANE_1, 'tab1', 'w1', states.pane1, NOW - 1_000, {
        interactivePrompt: QUESTION_JSON,
        toolName: 'AskUserQuestion'
      }),
      [PANE_2]: entry(PANE_2, 'tab2', 'w2', states.pane2, NOW - 9_000),
      [PANE_3]: entry(PANE_3, 'tab3', FOLDER_ID, states.pane3, NOW - 5_000, {
        subagents: [
          { id: 'child', agentType: 'Explore', state: 'blocked', startedAt: NOW - 20_000 }
        ]
      })
    },
    retainedAgentsByPaneKey: {},
    migrationUnsupportedByPtyId: {},
    runtimeAgentOrchestrationByPaneKey: {},
    terminalLayoutsByTabId: {
      tab1: layout(LEAF_1, 'pty-tab1'),
      tab2: layout(LEAF_2, 'pty-tab2'),
      tab3: layout(LEAF_3, 'pty-tab3')
    },
    ptyIdsByTabId: { tab1: ['pty-tab1'], tab2: ['pty-tab2'], tab3: ['pty-tab3'] },
    runtimePaneTitlesByTabId: {},
    acknowledgedAgentsByPaneKey: {},
    settings: null
  }
}

describe('buildNeedsYouRows', () => {
  it('returns nothing when no agent needs the user', () => {
    const state = baseState({ pane1: 'working', pane2: 'done', pane3: 'working' })
    expect(buildNeedsYouRows(state, NOW)).toEqual([])
  })

  it('returns only attention rows, oldest wait first, with workspace and prompt fields', () => {
    const state = baseState({ pane1: 'waiting', pane2: 'blocked', pane3: 'working' })
    const rows = buildNeedsYouRows(state, NOW)
    expect(rows.map((row) => row.paneKey)).toEqual([PANE_2, PANE_1])
    expect(rows[0]).toEqual({
      paneKey: PANE_2,
      tabId: 'tab2',
      worktreeId: 'w2',
      kind: 'blocked',
      stateStartedAt: NOW - 9_000,
      workspaceName: 'Workspace w2',
      projectName: 'Repo One',
      branch: 'feature-w2'
    })
    expect(rows[1]).toMatchObject({
      kind: 'waiting',
      promptText: 'Which database should I use?'
    })
  })

  it('excludes subagent rows even when the child is blocked', () => {
    // The folder workspace's parent is working; only its subagent child is blocked.
    const state = baseState({ pane1: 'working', pane2: 'working', pane3: 'working' })
    expect(buildNeedsYouRows(state, NOW)).toEqual([])
  })

  it('lists folder workspaces like worktrees, with no branch', () => {
    const state = baseState({ pane1: 'working', pane2: 'working', pane3: 'waiting' })
    const rows = buildNeedsYouRows(state, NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      paneKey: PANE_3,
      worktreeId: FOLDER_ID,
      workspaceName: 'Notes folder',
      projectName: 'Notes folder',
      branch: ''
    })
    expect(rows[0].promptText).toBeUndefined()
  })

  it('returns the previous array by identity when an unrelated slice changes', () => {
    const cache = createNeedsYouRowsCache()
    const state = baseState({ pane1: 'waiting', pane2: 'blocked', pane3: 'working' })
    const first = buildNeedsYouRows(state, NOW, cache, 1)
    const second = buildNeedsYouRows(
      { ...state, runtimePaneTitlesByTabId: { tab3: { 0: 'renamed' } } },
      NOW,
      cache,
      1
    )
    expect(second).toBe(first)
  })
})
