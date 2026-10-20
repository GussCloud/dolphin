import { describe, expect, it } from 'vitest'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import {
  ORBIT_MEMBER_BOX_WIDTH,
  ORBIT_MEMBER_SIZE,
  buildAgentTeams,
  layoutTeamOrbit,
  memberInitials,
  teamRingArcs
} from './agent-team-orbit-model'

function card(paneKey: string, overrides: Partial<DashboardCard> = {}): DashboardCard {
  return {
    paneKey,
    ptyId: null,
    agentType: 'claude',
    bucket: 'working',
    dotState: 'working',
    task: '',
    repoId: 'r1',
    worktreeId: 'w1',
    tabId: 't1',
    leafId: null,
    repoName: 'Repo',
    worktreeName: 'wt',
    startedAt: 0,
    finishedAt: null,
    stateChangedAt: 0,
    unseen: false,
    ...overrides
  }
}

describe('buildAgentTeams', () => {
  it('groups teammates under their visible lead and counts their states', () => {
    const [team, ...rest] = buildAgentTeams([
      card('lead', { conversationName: 'Crie um time' }),
      card('a', {
        parentPaneKey: 'lead',
        conversationName: 'primos',
        dotState: 'done',
        bucket: 'done'
      }),
      card('b', {
        parentPaneKey: 'lead',
        conversationName: 'tradutor',
        dotState: 'blocked',
        bucket: 'attention'
      }),
      card('c', { parentPaneKey: 'a', conversationName: 'neto' })
    ])
    expect(rest).toEqual([])
    expect(team.id).toBe('lead')
    expect(team.members.map((m) => [m.name, m.state])).toEqual([
      ['primos', 'done'],
      ['tradutor', 'ask'],
      ['neto', 'working']
    ])
    expect(team.counts).toEqual({ ask: 1, working: 1, done: 1, idle: 0 })
    expect(team.needsYou).toBe(true)
  })

  it('folds in-process subagents into the orbit as dashed members', () => {
    const [team] = buildAgentTeams([
      card('lead', { subagents: [{ id: 's1', name: 'Explore', dotState: 'idle' }] })
    ])
    expect(team.members).toEqual([
      expect.objectContaining({ kind: 'subagent', id: 'lead::s1', name: 'Explore', state: 'idle' })
    ])
  })

  it('treats hidden parents and parent cycles as separate leads', () => {
    const teams = buildAgentTeams([
      card('orphan', { parentPaneKey: 'filtered-out' }),
      card('x', { parentPaneKey: 'y' }),
      card('y', { parentPaneKey: 'x' })
    ])
    expect(teams.map((team) => [team.id, team.members.length])).toEqual([
      ['orphan', 0],
      ['x', 0],
      ['y', 0]
    ])
  })

  it('puts teams that need you first', () => {
    const teams = buildAgentTeams([
      card('calm', { startedAt: 1 }),
      card('busy', { startedAt: 2 }),
      card('ask', { parentPaneKey: 'busy', dotState: 'waiting', bucket: 'attention' })
    ])
    expect(teams.map((team) => team.id)).toEqual(['busy', 'calm'])
  })
})

describe('teamRingArcs', () => {
  it('draws one arc per member, or one full ring for a solo agent', () => {
    const [team, solo] = buildAgentTeams([
      card('lead'),
      card('a', { parentPaneKey: 'lead', dotState: 'done', bucket: 'done' }),
      card('b', { parentPaneKey: 'lead' }),
      card('c', { parentPaneKey: 'lead' }),
      card('solo', { startedAt: 9 })
    ])
    expect(teamRingArcs(team, 152, 6).map((arc) => arc.state)).toEqual([
      'done',
      'working',
      'working'
    ])
    expect(teamRingArcs(solo, 152, 6)).toHaveLength(1)
  })
})

describe('layoutTeamOrbit', () => {
  it('keeps every member avatar and label inside the stage without overlapping', () => {
    const cards = [card('lead')]
    for (let index = 0; index < 10; index += 1) {
      cards.push(card(`m${index}`, { parentPaneKey: 'lead', startedAt: index }))
    }
    const [team] = buildAgentTeams(cards)
    const layout = layoutTeamOrbit(team.members)
    expect(layout.edges).toHaveLength(10)
    const labelHeight = 40
    for (const point of layout.members) {
      expect(point.x - ORBIT_MEMBER_BOX_WIDTH / 2).toBeGreaterThanOrEqual(0)
      expect(point.x + ORBIT_MEMBER_BOX_WIDTH / 2).toBeLessThanOrEqual(layout.width)
      expect(point.y - ORBIT_MEMBER_SIZE / 2).toBeGreaterThanOrEqual(0)
      expect(point.y + ORBIT_MEMBER_SIZE / 2 + labelHeight).toBeLessThanOrEqual(layout.height)
    }
    for (const a of layout.members) {
      for (const b of layout.members) {
        if (a !== b) {
          const apart =
            Math.abs(a.x - b.x) >= ORBIT_MEMBER_BOX_WIDTH ||
            Math.abs(a.y - b.y) >= ORBIT_MEMBER_SIZE + labelHeight
          expect(apart).toBe(true)
        }
      }
    }
  })
})

describe('layoutTeamOrbit with large teams', () => {
  it('splits a 24-member team across two rings with action members inside', () => {
    const cards = [card('lead')]
    for (let index = 0; index < 24; index += 1) {
      const done = index % 3 !== 0
      cards.push(
        card(`m${index}`, {
          parentPaneKey: 'lead',
          startedAt: index,
          ...(done ? { dotState: 'done', bucket: 'done' } : {})
        })
      )
    }
    const [team] = buildAgentTeams(cards)
    const layout = layoutTeamOrbit(team.members)
    expect(layout.rings).toHaveLength(2)
    const distance = (id: string): number => {
      const point = layout.members.find((p) => p.id === id)
      return point ? Math.hypot(point.x - layout.center.x, point.y - layout.center.y) : -1
    }
    expect(distance('m0')).toBeLessThan(distance('m1'))
    const labelHeight = 40
    for (const a of layout.members) {
      for (const b of layout.members) {
        if (a !== b) {
          const apart =
            Math.abs(a.x - b.x) >= ORBIT_MEMBER_BOX_WIDTH ||
            Math.abs(a.y - b.y) >= ORBIT_MEMBER_SIZE + labelHeight
          expect(apart).toBe(true)
        }
      }
    }
  })
})

describe('memberInitials', () => {
  it('uses the first two letters, ignoring punctuation', () => {
    expect(memberInitials('package-json')).toBe('PA')
    expect(memberInitials('éclair')).toBe('ÉC')
  })
})
