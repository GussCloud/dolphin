import { describe, expect, it } from 'vitest'
import type {
  RuntimeWorktreeAgentRow,
  RuntimeWorktreePsSummary
} from '../../shared/runtime-worktree-contracts'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../shared/agent-status-types'
import {
  WORK_PRESENCE_MAX_AGENTS,
  buildWorkPresenceSnapshot,
  hashWorkPresenceId,
  mapAgentStatusToWorkPresenceState
} from './work-presence-snapshot'

const NOW = 1_800_000_000_000
const SECRET = 'TOP-SECRET-CONTENT'

function agentRow(
  paneKey: string,
  overrides: Partial<RuntimeWorktreeAgentRow> = {}
): RuntimeWorktreeAgentRow {
  return {
    paneKey,
    parentPaneKey: null,
    state: 'working',
    agentType: 'claude',
    prompt: `${SECRET} prompt`,
    taskTitle: `${SECRET} title`,
    displayName: `${SECRET} display`,
    lastAssistantMessage: `${SECRET} message`,
    toolName: `${SECRET} tool`,
    toolInput: `${SECRET} input /home/marina/private`,
    interrupted: false,
    stateStartedAt: NOW - 1_000,
    updatedAt: NOW - 1_000,
    ...overrides
  }
}

function summary(
  overrides: Partial<RuntimeWorktreePsSummary> & Pick<RuntimeWorktreePsSummary, 'agents'>
): RuntimeWorktreePsSummary {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The snapshot reads only repoId/repo/branch/workspaceKind/agents; the rest is fixture noise.
  return {
    worktreeId: 'repo-1::/home/marina/secret-path/dolphin',
    repoId: 'repo-1',
    repo: 'dolphin',
    path: '/home/marina/secret-path/dolphin',
    branch: 'refs/heads/feat/pix',
    displayName: `${SECRET} workspace`,
    comment: `${SECRET} comment`,
    preview: `${SECRET} preview`,
    ...overrides
  } as RuntimeWorktreePsSummary
}

function snapshotOf(summaries: RuntimeWorktreePsSummary[]) {
  return buildWorkPresenceSnapshot({
    machineId: 'machine-1',
    machineLabel: 'marina-mbp',
    summaries,
    now: NOW
  })
}

describe('mapAgentStatusToWorkPresenceState', () => {
  it('maps the store vocabulary onto the contract table', () => {
    expect(mapAgentStatusToWorkPresenceState('working')).toBe('working')
    expect(mapAgentStatusToWorkPresenceState('blocked')).toBe('permission')
    expect(mapAgentStatusToWorkPresenceState('waiting')).toBe('permission')
    expect(mapAgentStatusToWorkPresenceState('done')).toBe('idle')
  })
})

describe('buildWorkPresenceSnapshot', () => {
  it('groups agents by repository with hashed ids and a stripped branch', () => {
    const snapshot = snapshotOf([
      summary({ agents: [agentRow('tab-1:leaf-a')] }),
      summary({
        worktreeId: 'repo-1::/w/second',
        branch: 'main',
        agents: [agentRow('tab-2:leaf-b', { state: 'waiting', agentType: 'codex' })]
      }),
      summary({
        repoId: 'folder-1',
        repo: 'notes',
        workspaceKind: 'folder-workspace',
        agents: [agentRow('tab-3:leaf-c', { state: 'done' })]
      })
    ])
    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.projects).toHaveLength(2)
    const dolphin = snapshot.projects.find((project) => project.name === 'dolphin')
    expect(dolphin?.id).toBe(hashWorkPresenceId('machine-1', 'repo-1'))
    expect(dolphin?.id).toMatch(/^[0-9a-f]{16}$/)
    expect(dolphin?.agents).toEqual(
      expect.arrayContaining([
        {
          id: hashWorkPresenceId('machine-1', 'tab-1:leaf-a'),
          cli: 'claude',
          state: 'working',
          branch: 'feat/pix'
        },
        {
          id: hashWorkPresenceId('machine-1', 'tab-2:leaf-b'),
          cli: 'codex',
          state: 'permission',
          branch: 'main'
        }
      ])
    )
    const notes = snapshot.projects.find((project) => project.name === 'notes')
    expect(notes?.agents).toEqual([
      {
        id: hashWorkPresenceId('machine-1', 'tab-3:leaf-c'),
        cli: 'claude',
        state: 'idle',
        branch: null
      }
    ])
  })

  it('leaves out rows the store would not display', () => {
    const stale = NOW - AGENT_STATUS_STALE_AFTER_MS - 1
    const snapshot = snapshotOf([
      summary({
        agents: [
          agentRow('restored', { restoredUnconfirmed: true }),
          agentRow('decayed', { updatedAt: stale }),
          agentRow('host-owned', { updatedAt: stale, structuredHostOwned: true }),
          agentRow('live')
        ]
      }),
      summary({ repoId: 'empty', repo: 'empty', agents: [] })
    ])
    expect(snapshot.projects).toHaveLength(1)
    expect(snapshot.projects[0].agents.map((agent) => agent.id).sort()).toEqual(
      [
        hashWorkPresenceId('machine-1', 'host-owned'),
        hashWorkPresenceId('machine-1', 'live')
      ].sort()
    )
  })

  it('caps agents per machine and truncates long names', () => {
    const agents = Array.from({ length: WORK_PRESENCE_MAX_AGENTS + 20 }, (_, index) =>
      agentRow(`pane-${index}`)
    )
    const snapshot = buildWorkPresenceSnapshot({
      machineId: 'machine-1',
      machineLabel: 'h'.repeat(100),
      summaries: [summary({ repo: 'r'.repeat(200), branch: 'b'.repeat(300), agents })],
      now: NOW
    })
    expect(snapshot.machineLabel).toHaveLength(64)
    expect(snapshot.projects[0].name).toHaveLength(80)
    expect(snapshot.projects[0].agents).toHaveLength(WORK_PRESENCE_MAX_AGENTS)
    expect(snapshot.projects[0].agents[0].branch).toHaveLength(120)
  })

  it('serializes identically for the same roster in any order', () => {
    const a = summary({ agents: [agentRow('x'), agentRow('y')] })
    const b = summary({ agents: [agentRow('y'), agentRow('x')] })
    expect(JSON.stringify(snapshotOf([a]))).toBe(JSON.stringify(snapshotOf([b])))
  })
})

describe('work presence privacy boundary', () => {
  it('salts ids with the machine so a local id cannot be confirmed by guessing', () => {
    expect(hashWorkPresenceId('machine-1', 'repo-1')).not.toBe(
      hashWorkPresenceId('machine-2', 'repo-1')
    )
    expect(hashWorkPresenceId('machine-1', 'repo-1')).toMatch(/^[0-9a-f]{16}$/)
  })

  it('never sends prompts, tool input, messages, titles, paths or local ids', () => {
    const snapshot = snapshotOf([
      summary({
        agents: [agentRow('tab-1:leaf-a'), agentRow('tab-2:leaf-b', { state: 'blocked' })]
      })
    ])
    const json = JSON.stringify(snapshot)
    for (const forbidden of [SECRET, '/home/marina', 'secret-path', 'tab-1:leaf-a', 'repo-1']) {
      expect(json).not.toContain(forbidden)
    }
    const allowedKeys = new Set([
      'schemaVersion',
      'machineId',
      'machineLabel',
      'projects',
      'id',
      'name',
      'agents',
      'cli',
      'state',
      'branch'
    ])
    const keys = new Set<string>()
    JSON.parse(json, (key: string, value: unknown) => {
      if (key && Number.isNaN(Number(key))) {
        keys.add(key)
      }
      return value
    })
    expect([...keys].filter((key) => !allowedKeys.has(key))).toEqual([])
  })
})
