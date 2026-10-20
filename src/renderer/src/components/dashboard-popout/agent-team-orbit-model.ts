import {
  DASHBOARD_BUCKET_ORDER,
  type DashboardCard,
  type DashboardCardDotState,
  type DashboardCardSubagent
} from '../../../../shared/dashboard-snapshot'

export type AgentTeamMemberState = 'ask' | 'working' | 'done' | 'idle'

export type AgentTeamMember =
  | { kind: 'agent'; id: string; name: string; state: AgentTeamMemberState; card: DashboardCard }
  | {
      kind: 'subagent'
      id: string
      name: string
      state: AgentTeamMemberState
      subagent: DashboardCardSubagent
    }

export type AgentTeam = {
  id: string
  leader: DashboardCard
  leaderState: AgentTeamMemberState
  members: AgentTeamMember[]
  counts: Record<AgentTeamMemberState, number>
  needsYou: boolean
}

export function memberStateFromDot(dotState: DashboardCardDotState): AgentTeamMemberState {
  switch (dotState) {
    case 'blocked':
    case 'waiting':
      return 'ask'
    case 'working':
      return 'working'
    case 'done':
      return 'done'
    case 'idle':
      return 'idle'
  }
}

export function agentDisplayName(card: DashboardCard): string {
  return card.conversationName ?? card.worktreeName
}

export function memberInitials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, '')
  return (letters || name).slice(0, 2).toUpperCase()
}

/** Parent links only count when the parent is visible and the chain is acyclic. */
function resolveParents(cards: readonly DashboardCard[]): Map<string, string> {
  const byPaneKey = new Map(cards.map((card) => [card.paneKey, card]))
  const parentByPaneKey = new Map<string, string>()
  for (const card of cards) {
    const parent = card.parentPaneKey
    if (!parent || parent === card.paneKey || !byPaneKey.has(parent)) {
      continue
    }
    const seen = new Set([card.paneKey])
    let cursor: string | undefined = parent
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      cursor = parentByPaneKey.get(cursor) ?? byPaneKey.get(cursor)?.parentPaneKey
    }
    if (!cursor) {
      parentByPaneKey.set(card.paneKey, parent)
    }
  }
  return parentByPaneKey
}

function subagentMembers(card: DashboardCard): AgentTeamMember[] {
  return (card.subagents ?? []).map((subagent) => ({
    kind: 'subagent',
    id: `${card.paneKey}::${subagent.id}`,
    name: subagent.name,
    state: memberStateFromDot(subagent.dotState),
    subagent
  }))
}

/** One team per root agent; every visible descendant (and in-process subagent) joins its orbit. */
export function buildAgentTeams(cards: readonly DashboardCard[]): AgentTeam[] {
  const parentByPaneKey = resolveParents(cards)
  const childrenByPaneKey = new Map<string, DashboardCard[]>()
  const roots: DashboardCard[] = []
  for (const card of cards) {
    const parent = parentByPaneKey.get(card.paneKey)
    if (!parent) {
      roots.push(card)
      continue
    }
    const siblings = childrenByPaneKey.get(parent)
    if (siblings) {
      siblings.push(card)
    } else {
      childrenByPaneKey.set(parent, [card])
    }
  }

  const teams = roots.map((leader): AgentTeam => {
    const members: AgentTeamMember[] = subagentMembers(leader)
    const queue = [...(childrenByPaneKey.get(leader.paneKey) ?? [])]
    while (queue.length > 0) {
      const card = queue.shift()
      if (!card) {
        break
      }
      members.push({
        kind: 'agent',
        id: card.paneKey,
        name: agentDisplayName(card),
        state: memberStateFromDot(card.dotState),
        card
      })
      members.push(...subagentMembers(card))
      queue.push(...(childrenByPaneKey.get(card.paneKey) ?? []))
    }
    const counts: Record<AgentTeamMemberState, number> = { ask: 0, working: 0, done: 0, idle: 0 }
    for (const member of members) {
      counts[member.state] += 1
    }
    const leaderState = memberStateFromDot(leader.dotState)
    return {
      id: leader.paneKey,
      leader,
      leaderState,
      members,
      counts,
      needsYou: counts.ask > 0 || leaderState === 'ask'
    }
  })

  const rank = (team: AgentTeam): number =>
    team.needsYou ? -1 : DASHBOARD_BUCKET_ORDER.indexOf(team.leader.bucket)
  return teams.sort((a, b) => rank(a) - rank(b) || a.leader.startedAt - b.leader.startedAt)
}

export type AgentTeamRingArc = { d: string; state: AgentTeamMemberState }

/** One arc per member around a leader avatar; a solo agent gets one full ring in its own state. */
export function teamRingArcs(team: AgentTeam, size: number, stroke: number): AgentTeamRingArc[] {
  const center = size / 2
  const radius = center - stroke / 2
  const states = team.members.length > 0 ? team.members.map((m) => m.state) : [team.leaderState]
  if (states.length === 1) {
    return [
      {
        d: `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`,
        state: states[0]
      }
    ]
  }
  const span = (2 * Math.PI) / states.length
  const gap = Math.min(0.16, span * 0.3)
  const point = (angle: number): string =>
    `${(center + radius * Math.cos(angle)).toFixed(2)} ${(center + radius * Math.sin(angle)).toFixed(2)}`
  return states.map((state, index) => {
    // Why: centre each arc on its member's orbit angle so the ring points at who it counts.
    const start = -Math.PI / 2 + index * span - span / 2 + gap / 2
    const end = start + span - gap
    const largeArc = end - start > Math.PI ? 1 : 0
    return { d: `M ${point(start)} A ${radius} ${radius} 0 ${largeArc} 1 ${point(end)}`, state }
  })
}

export const ORBIT_LEADER_SIZE = 152
export const ORBIT_MEMBER_SIZE = 56
export const ORBIT_MEMBER_BOX_WIDTH = 148

export type AgentTeamOrbitLayout = {
  width: number
  height: number
  center: { x: number; y: number }
  members: { id: string; x: number; y: number }[]
  edges: { id: string; d: string }[]
}

/** Members sit on an ellipse that grows with the team so labels never collide. */
export function layoutTeamOrbit(members: readonly AgentTeamMember[]): AgentTeamOrbitLayout {
  const count = Math.max(1, members.length)
  const rx = Math.min(440, Math.max(230, 170 + count * 22))
  const ry = Math.round(rx * 0.66)
  const width = rx * 2 + ORBIT_MEMBER_BOX_WIDTH + 24
  const height = ry * 2 + ORBIT_MEMBER_SIZE + 72
  const center = { x: width / 2, y: ry + ORBIT_MEMBER_SIZE / 2 + 8 }
  const leaderRadius = ORBIT_LEADER_SIZE / 2 + 6
  const memberRadius = ORBIT_MEMBER_SIZE / 2 + 6
  const placed = members.map((member, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
    return {
      id: member.id,
      angle,
      x: center.x + rx * Math.cos(angle),
      y: center.y + ry * Math.sin(angle)
    }
  })
  return {
    width,
    height,
    center,
    members: placed.map(({ id, x, y }) => ({ id, x, y })),
    edges: placed.map(({ id, angle, x, y }) => {
      const x1 = center.x + leaderRadius * Math.cos(angle)
      const y1 = center.y + leaderRadius * Math.sin(angle)
      const x2 = x - memberRadius * Math.cos(angle)
      const y2 = y - memberRadius * Math.sin(angle)
      // Why: a slight sideways bow keeps neighbouring spokes from reading as one line.
      const bow = 28
      const mx = (x1 + x2) / 2 - bow * Math.sin(angle)
      const my = (y1 + y2) / 2 + bow * Math.cos(angle)
      return {
        id,
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
      }
    })
  }
}
