import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { TerminalTab } from '../../../shared/terminal-tab-types'
import {
  DEFAULT_AGENT_HIBERNATION_IDLE_MS,
  planAgentHibernationCandidates,
  type AgentHibernationPlannerSnapshot
} from './agent-hibernation-planner'

const NOW = 50_000_000
const LEAF = '11111111-1111-4111-8111-111111111111'
// Done two minutes ago: far inside the 30-minute default window.
const RECENT = NOW - 2 * 60_000

function tab(worktreeId: string): TerminalTab {
  return {
    id: `tab-${worktreeId}`,
    ptyId: null,
    worktreeId,
    title: 'Agent',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
}

function entry(worktreeId: string, overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'done',
    prompt: 'done',
    updatedAt: RECENT,
    stateStartedAt: RECENT,
    paneKey: `tab-${worktreeId}:${LEAF}`,
    tabId: `tab-${worktreeId}`,
    worktreeId,
    agentType: 'claude',
    providerSession: { key: 'session_id', id: `session-${worktreeId}` },
    stateHistory: [],
    ...overrides
  }
}

function snapshot(
  overrides: Partial<AgentHibernationPlannerSnapshot> = {}
): AgentHibernationPlannerSnapshot {
  const worktreeIds = ['wt-local', 'wt-ssh']
  return {
    settings: {
      experimentalAgentHibernation: true,
      agentHibernationIdleMs: DEFAULT_AGENT_HIBERNATION_IDLE_MS
    },
    activeWorktreeId: 'wt-active',
    foregroundTerminalTabIds: [],
    tabsByWorktree: Object.fromEntries(worktreeIds.map((id) => [id, [tab(id)]])),
    terminalLayoutsByTabId: Object.fromEntries(
      worktreeIds.map((id) => [
        `tab-${id}`,
        {
          root: { type: 'leaf', leafId: LEAF },
          activeLeafId: LEAF,
          expandedLeafId: null,
          ptyIdsByLeafId: { [LEAF]: `pty-${id}` }
        }
      ])
    ),
    ptyIdsByTabId: Object.fromEntries(worktreeIds.map((id) => [`tab-${id}`, [`pty-${id}`]])),
    mobileLockedPtyIds: [],
    agentStatusByPaneKey: Object.fromEntries(
      worktreeIds.map((id) => [`tab-${id}:${LEAF}`, entry(id)])
    ),
    sleepingAgentSessionsByPaneKey: {},
    lastTerminalInputAtByPaneKey: {},
    foregroundTerminalLastSeenAtByTabId: {},
    hostLocalWorktreeIds: ['wt-local'],
    now: NOW,
    ...overrides
  }
}

const planned = (input: AgentHibernationPlannerSnapshot): string[] =>
  planAgentHibernationCandidates(input).map((candidate) => candidate.worktreeId)

describe('agent hibernation planner under host memory pressure', () => {
  it('keeps the configured window without pressure', () => {
    expect(planned(snapshot())).toEqual([])
    expect(planned(snapshot({ hostMemoryPressureLevel: 'none' }))).toEqual([])
  })

  it('shortens the window only for agents running on this host', () => {
    expect(planned(snapshot({ hostMemoryPressureLevel: 'critical' }))).toEqual(['wt-local'])
  })

  it('shortens elevated pressure to a quarter of the window, not to the floor', () => {
    expect(planned(snapshot({ hostMemoryPressureLevel: 'elevated' }))).toEqual([])
    const quarterAgo = NOW - DEFAULT_AGENT_HIBERNATION_IDLE_MS / 4 - 1
    const local = entry('wt-local', { stateStartedAt: quarterAgo, updatedAt: quarterAgo })
    expect(
      planned(
        snapshot({
          hostMemoryPressureLevel: 'elevated',
          agentStatusByPaneKey: { [local.paneKey]: local }
        })
      )
    ).toEqual(['wt-local'])
  })

  it('never goes below the one-minute floor', () => {
    const justDone = NOW - 30_000
    const local = entry('wt-local', { stateStartedAt: justDone, updatedAt: justDone })
    expect(
      planned(
        snapshot({
          hostMemoryPressureLevel: 'critical',
          agentStatusByPaneKey: { [local.paneKey]: local }
        })
      )
    ).toEqual([])
  })

  it('keeps every other safety gate under critical pressure', () => {
    const critical = { hostMemoryPressureLevel: 'critical' as const }
    expect(planned(snapshot({ ...critical, foregroundTerminalTabIds: ['tab-wt-local'] }))).toEqual(
      []
    )
    expect(
      planned(
        snapshot({
          ...critical,
          foregroundTerminalLastSeenAtByTabId: { 'tab-wt-local': NOW - 30_000 }
        })
      )
    ).toEqual([])
    expect(
      planned(
        snapshot({
          ...critical,
          lastTerminalInputAtByPaneKey: { [`tab-wt-local:${LEAF}`]: RECENT + 1 }
        })
      )
    ).toEqual([])
    expect(planned(snapshot({ ...critical, mobileLockedPtyIds: ['pty-wt-local'] }))).toEqual([])
    const working = entry('wt-local', { state: 'working' })
    expect(
      planned(snapshot({ ...critical, agentStatusByPaneKey: { [working.paneKey]: working } }))
    ).toEqual([])
  })
})
