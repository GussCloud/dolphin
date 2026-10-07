import { describe, expect, it } from 'vitest'
import type { AgentStatusIpcPayload, AgentSubagentSnapshot } from '../../shared/agent-status-types'
import type { RuntimeWorktreePsSummary } from '../../shared/runtime-types'
import { attachRuntimeWorktreeAgentRows } from './runtime-worktree-agent-rows'
import { collectRuntimeWorktreeAgentSources } from './runtime-worktree-agent-sources'

const WORKTREE_ID = 'repo-1::/workspace/app'
const PANE_KEY = 'tab-1:0'
const NOW = Date.now()

const TEAMMATES: AgentSubagentSnapshot[] = [
  {
    id: 'agent-a',
    agentType: 'researcher',
    description: 'Map the API',
    state: 'working',
    startedAt: NOW - 5_000
  },
  { id: 'agent-b', state: 'idle', startedAt: NOW - 9_000 }
]

function hookRow(over: Partial<AgentStatusIpcPayload> = {}): AgentStatusIpcPayload {
  return {
    paneKey: PANE_KEY,
    tabId: 'tab-1',
    worktreeId: WORKTREE_ID,
    connectionId: null,
    state: 'working',
    prompt: 'lead the team',
    agentType: 'claude',
    stateStartedAt: NOW - 10_000,
    receivedAt: NOW,
    ...over
  }
}

function emptySummary(): RuntimeWorktreePsSummary {
  return {
    worktreeId: WORKTREE_ID,
    repoId: 'repo-1',
    repo: 'app',
    path: '/workspace/app',
    branch: 'main',
    isArchived: false,
    isMainWorktree: true,
    hasHostSidebarActivity: false,
    parentWorktreeId: null,
    childWorktreeIds: [],
    displayName: 'app',
    workspaceStatus: 'active',
    sortOrder: 0,
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    linkedGitLabMR: null,
    linkedGitLabIssue: null,
    comment: '',
    isPinned: false,
    isActive: false,
    unread: false,
    liveTerminalCount: 1,
    hasAttachedPty: true,
    lastOutputAt: null,
    preview: '',
    status: 'inactive',
    agents: []
  }
}

function rowsFor(
  entry: AgentStatusIpcPayload,
  localPtyConnected = true
): RuntimeWorktreePsSummary['agents'] {
  const summary = emptySummary()
  const summaries = new Map([[WORKTREE_ID, summary]])
  attachRuntimeWorktreeAgentRows({
    summaries,
    pathIndex: {
      platformByRepoId: new Map(),
      posixAbsolute: new Map(),
      posixRelative: new Map(),
      windows: new Map(),
      windowsAbsolute: new Map()
    },
    missingWorktreeIds: new Set(),
    workingTerminalEvidenceByWorktreeId: new Map(),
    rowSources: collectRuntimeWorktreeAgentSources({
      hookSnapshots: [entry],
      mirroredWorktreeIdByTabId: new Map(),
      connectedPtyEvidence: {
        tabIds: new Set(localPtyConnected ? ['tab-1'] : []),
        paneKeys: new Set(localPtyConnected ? [PANE_KEY] : []),
        ptyIdByTerminalHandle: new Map()
      }
    }),
    orchestrationByPaneKey: null,
    getSummary: (map, _paths, _missing, id) => map.get(id) ?? null
  })
  return summary.agents
}

describe('worktree ps agent row subagents', () => {
  it('publishes the status entry subagents on the leader row', () => {
    const [row] = rowsFor(hookRow({ subagents: TEAMMATES }))
    expect(row?.subagents).toEqual(TEAMMATES)
  })

  it('omits the field when the entry tracks no subagents', () => {
    expect(rowsFor(hookRow())[0]).not.toHaveProperty('subagents')
    expect(rowsFor(hookRow({ subagents: [] }))[0]).not.toHaveProperty('subagents')
  })

  it('carries subagents for an SSH-hosted leader the same way', () => {
    // No local PTY: the remote host's row is admitted on its own evidence.
    const [row] = rowsFor(hookRow({ connectionId: 'ssh-connection', subagents: TEAMMATES }), false)
    expect(row?.subagents).toEqual(TEAMMATES)
  })
})
