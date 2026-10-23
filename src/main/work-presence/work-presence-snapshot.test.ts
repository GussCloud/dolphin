import { describe, expect, it } from 'vitest'
import type {
  RuntimeWorktreeAgentRow,
  RuntimeWorktreePsSummary
} from '../../shared/runtime-worktree-contracts'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../shared/agent-status-types'
import type { TerminalTab } from '../../shared/terminal-tab-types'
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

  it('names a DeepSeek row by the host display stamp, not the claude harness', () => {
    const snapshot = snapshotOf([
      summary({ agents: [agentRow('tab-1:leaf-a', { displayAgentType: 'deepseek' })] })
    ])
    expect(snapshot.projects[0]?.agents[0]?.cli).toBe('deepseek')
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

describe('agent names', () => {
  const LEADER_LEAF = '11111111-1111-4111-8111-111111111111'
  const TEAMMATE_LEAF = '22222222-2222-4222-8222-222222222222'
  const leaderKey = `tab-team:${LEADER_LEAF}`
  const teammateKey = `tab-team:${TEAMMATE_LEAF}`

  function tab(overrides: Partial<TerminalTab> = {}): TerminalTab {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Names read only the title fields; the rest is fixture noise.
    return {
      id: 'tab-team',
      customTitle: null,
      title: `${SECRET} live title`,
      generatedTitle: `${SECRET} generated`,
      aiVaultTitle: { title: `${SECRET} vault` },
      ...overrides
    } as TerminalTab
  }

  function namesOf(
    paneKeys: string[],
    sources: { teammates?: [string, string][]; tabs?: TerminalTab[] }
  ): (string | undefined)[] {
    const snapshot = buildWorkPresenceSnapshot({
      machineId: 'machine-1',
      machineLabel: 'host',
      summaries: [summary({ agents: paneKeys.map((paneKey) => agentRow(paneKey)) })],
      now: NOW,
      nameSources: {
        teammateNamesByPaneKey: new Map(sources.teammates ?? []),
        tabsById: new Map((sources.tabs ?? []).map((entry) => [entry.id, entry]))
      }
    })
    const agents = snapshot.projects[0]?.agents ?? []
    return paneKeys.map(
      (paneKey) =>
        agents.find((agent) => agent.id === hashWorkPresenceId('machine-1', paneKey))?.name
    )
  }

  it('prefers the teammate name per pane, then the tab rename, then the quick command', () => {
    const tabs = [tab({ customTitle: '  Backend  ', quickCommandLabel: 'npm test' })]
    expect(namesOf([leaderKey, teammateKey], { teammates: [[teammateKey, 'impl']], tabs })).toEqual(
      ['Backend', 'impl']
    )
    expect(namesOf([leaderKey], { tabs: [tab({ quickCommandLabel: 'npm test' })] })).toEqual([
      'npm test'
    ])
  })

  it('omits the name rather than sending generated, AI-vault or live titles', () => {
    const snapshot = buildWorkPresenceSnapshot({
      machineId: 'machine-1',
      machineLabel: 'host',
      summaries: [summary({ agents: [agentRow(leaderKey)] })],
      now: NOW,
      nameSources: { teammateNamesByPaneKey: new Map(), tabsById: new Map([['tab-team', tab()]]) }
    })
    const json = JSON.stringify(snapshot)
    expect(json).not.toContain(SECRET)
    expect(snapshot.projects[0]?.agents[0]).not.toHaveProperty('name')
    expect(namesOf([leaderKey], { tabs: [tab({ customTitle: '   ' })] })).toEqual([undefined])
  })

  it('caps names at 60 characters without splitting a surrogate pair, and strips control characters', () => {
    const [long] = namesOf([leaderKey], { tabs: [tab({ customTitle: `${'a'.repeat(59)}😀tail` })] })
    expect(long).toBe('a'.repeat(59))
    const [exact] = namesOf([teammateKey], { teammates: [[teammateKey, 'n'.repeat(80)]] })
    expect(exact).toBe('n'.repeat(60))
    const [clean] = namesOf([teammateKey], { teammates: [[teammateKey, 'rev\u001b[31miew\n']] })
    expect(clean).toBe('rev [31miew')
    const [bidi] = namesOf([teammateKey], { teammates: [[teammateKey, '\u202eimpl\u2066x\u2069']] })
    expect(bidi).toBe('impl x')
  })
})
