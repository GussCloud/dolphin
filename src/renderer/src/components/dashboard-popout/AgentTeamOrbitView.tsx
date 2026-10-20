import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'
import {
  ORBIT_LEADER_SIZE,
  ORBIT_MEMBER_BOX_WIDTH,
  ORBIT_MEMBER_SIZE,
  agentDisplayName,
  buildAgentTeams,
  layoutTeamOrbit,
  type AgentTeam,
  type AgentTeamMember,
  type AgentTeamMemberState
} from './agent-team-orbit-model'
import {
  AgentTeamLeaderAvatar,
  AgentTeamMemberAvatar,
  MEMBER_STATE_STROKE,
  MEMBER_STATE_TEXT
} from './AgentTeamAvatars'

function stateLabel(state: AgentTeamMemberState): string {
  switch (state) {
    case 'ask':
      return translate('dashboardPopout.bucket.attention', 'Needs You')
    case 'working':
      return translate('dashboardPopout.bucket.working', 'Working')
    case 'done':
      return translate('dashboardPopout.bucket.done', 'Done')
    case 'idle':
      return translate('dashboardPopout.bucket.idle', 'Idle')
  }
}

function teamSummary(team: AgentTeam): string {
  if (team.members.length === 0) {
    return translate('dashboardPopout.orbit.solo', 'Solo agent')
  }
  const parts = [
    translate('dashboardPopout.orbit.summary', '{{working}} working · {{done}} done', {
      working: team.counts.working,
      done: team.counts.done
    })
  ]
  if (team.counts.ask > 0) {
    parts.push(
      translate('dashboardPopout.orbit.needsYou', '{{count}} needs you', { count: team.counts.ask })
    )
  }
  return parts.join(' · ')
}

function memberDetail(member: AgentTeamMember): string {
  if (member.kind === 'subagent') {
    return translate('dashboardPopout.orbit.subagent', 'In-process subagent')
  }
  const card = member.card
  return card.askSummary || card.lastAgentMessage || card.task || card.lastUserMessage || ''
}

function memberTask(member: AgentTeamMember): string {
  if (member.kind === 'subagent') {
    return stateLabel(member.state)
  }
  return member.card.askSummary || member.card.lastAgentMessage || member.card.task || ''
}

function leaderActionLabel(team: AgentTeam): string {
  const name = agentDisplayName(team.leader)
  return team.members.length > 0
    ? translate('dashboardPopout.orbit.openTeam', 'Open team: {{name}}', { name })
    : translate('dashboardPopout.orbit.openAgentTerminal', 'Open terminal: {{name}}', { name })
}

function TeamOverview({
  teams,
  onSelectTeam
}: {
  teams: AgentTeam[]
  onSelectTeam: (team: AgentTeam) => void
}): React.JSX.Element {
  return (
    <div className="flex w-full flex-col items-center gap-6 py-6">
      <div className="flex w-full max-w-[1200px] flex-wrap justify-center gap-x-10 gap-y-8">
        {teams.map((team) => (
          <div key={team.id} className="flex w-[240px] flex-col items-center gap-3 text-center">
            <AgentTeamLeaderAvatar
              team={team}
              size="lg"
              label={leaderActionLabel(team)}
              onClick={() => onSelectTeam(team)}
            />
            <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-foreground">
              {agentDisplayName(team.leader)}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{teamSummary(team)}</span>
            {team.leader.conversationName ? (
              <span className="max-w-full truncate font-mono text-[10.5px] text-muted-foreground">
                {team.leader.worktreeName}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {translate('dashboardPopout.orbit.hint', 'Select a lead to open its team')}
      </p>
    </div>
  )
}

function TeamStage({
  team,
  selectedId,
  onSelectMember,
  onOpenTerminal
}: {
  team: AgentTeam
  selectedId: string | null
  onSelectMember: (member: AgentTeamMember) => void
  onOpenTerminal: (card: DashboardCard) => void
}): React.JSX.Element {
  const layout = useMemo(() => layoutTeamOrbit(team.members), [team.members])
  const stateById = new Map(team.members.map((member) => [member.id, member.state]))
  const selectedEdge = layout.edges.find((edge) => edge.id === selectedId)
  return (
    <div
      data-testid="agent-team-stage"
      className="relative mx-auto shrink-0"
      style={{ width: layout.width, height: layout.height }}
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
      >
        {layout.edges.map((edge, index) => {
          const state = stateById.get(edge.id) ?? 'idle'
          return (
            <g key={edge.id}>
              <path
                data-testid="agent-team-edge"
                d={edge.d}
                pathLength={1}
                fill="none"
                strokeWidth={state === 'ask' ? 2 : 1.5}
                strokeLinecap="round"
                style={{ animationDelay: `${index * 40}ms` }}
                className={cn(
                  'agent-orbit-draw',
                  state === 'ask' ? 'stroke-agent-question/80' : 'stroke-border'
                )}
              />
              {state === 'working' ? (
                <path
                  d={edge.d}
                  fill="none"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  className={cn('agent-orbit-flow', MEMBER_STATE_STROKE.working)}
                />
              ) : null}
            </g>
          )
        })}
        {selectedEdge ? (
          <path
            d={selectedEdge.d}
            fill="none"
            strokeWidth={2.25}
            strokeLinecap="round"
            className="stroke-ring"
          />
        ) : null}
      </svg>
      <div
        className="absolute"
        style={{
          left: layout.center.x - ORBIT_LEADER_SIZE / 2,
          top: layout.center.y - ORBIT_LEADER_SIZE / 2
        }}
      >
        <AgentTeamLeaderAvatar
          team={team}
          size="lg"
          label={translate(
            'dashboardPopout.orbit.openLeadTerminal',
            'Open lead terminal: {{name}}',
            {
              name: agentDisplayName(team.leader)
            }
          )}
          onClick={() => onOpenTerminal(team.leader)}
        />
      </div>
      {team.members.map((member, index) => {
        const point = layout.members[index]
        return (
          <button
            key={member.id}
            type="button"
            data-testid="agent-team-member"
            aria-label={member.name}
            aria-pressed={member.id === selectedId}
            onClick={() => onSelectMember(member)}
            style={{
              left: point.x - ORBIT_MEMBER_BOX_WIDTH / 2,
              top: point.y - ORBIT_MEMBER_SIZE / 2,
              width: ORBIT_MEMBER_BOX_WIDTH,
              animationDelay: `${index * 40}ms`
            }}
            className="agent-orbit-pop absolute flex flex-col items-center gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <AgentTeamMemberAvatar member={member} selected={member.id === selectedId} />
            <span className="max-w-full truncate text-[12px] font-semibold text-foreground">
              {member.name}
            </span>
            <span className="max-w-full truncate text-[11px] leading-tight text-muted-foreground">
              {memberTask(member)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TeamRail({
  team,
  teams,
  selected,
  onBack,
  onSelectTeam,
  onOpenTerminal
}: {
  team: AgentTeam
  teams: AgentTeam[]
  selected: AgentTeamMember | null
  onBack: () => void
  onSelectTeam: (team: AgentTeam) => void
  onOpenTerminal: (card: DashboardCard) => void
}): React.JSX.Element {
  const others = teams.filter((candidate) => candidate.id !== team.id)
  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-4">
      <Button variant="outline" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeft />
        {translate('dashboardPopout.orbit.back', 'All tasks')}
      </Button>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-foreground">
          {agentDisplayName(team.leader)}
        </span>
        <span className="text-[11.5px] text-muted-foreground">{teamSummary(team)}</span>
      </div>
      {others.length > 0 ? (
        <div className="flex flex-col gap-2">
          {others.map((other) => (
            <div key={other.id} className="flex items-center gap-2.5">
              <AgentTeamLeaderAvatar
                team={other}
                size="sm"
                label={leaderActionLabel(other)}
                onClick={() => onSelectTeam(other)}
              />
              <span className="min-w-0 truncate text-[12px] text-muted-foreground">
                {agentDisplayName(other.leader)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5">
        {selected ? (
          <>
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-foreground">
                {selected.name}
              </span>
              <span
                className={cn('ml-auto shrink-0 text-[11px]', MEMBER_STATE_TEXT[selected.state])}
              >
                {stateLabel(selected.state)}
              </span>
            </div>
            <p className="line-clamp-4 text-[12px] leading-snug text-foreground/85">
              {memberDetail(selected)}
            </p>
            {selected.kind === 'agent' ? (
              <Button size="sm" onClick={() => onOpenTerminal(selected.card)}>
                {translate('dashboardPopout.orbit.openTerminal', 'Open terminal')}
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">
            {translate('dashboardPopout.orbit.selectMember', 'Select a teammate to see its task')}
          </p>
        )}
      </div>
    </div>
  )
}

/** Leads first; selecting one opens its teammates in orbit. Built only from the board's snapshot. */
export function AgentTeamOrbitView({
  cards,
  onOpenTerminal
}: {
  cards: DashboardCard[]
  onOpenTerminal: (card: DashboardCard) => void
}): React.JSX.Element {
  const teams = useMemo(() => buildAgentTeams(cards), [cards])
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const openTeam = teams.find((team) => team.id === openTeamId && team.members.length > 0)
  const selected = openTeam?.members.find((member) => member.id === selectedId) ?? null

  const selectTeam = (team: AgentTeam): void => {
    // Why: a solo agent has no orbit to open, so its avatar goes straight to the terminal.
    if (team.members.length === 0) {
      onOpenTerminal(team.leader)
      return
    }
    setOpenTeamId(team.id)
    setSelectedId(team.members.find((member) => member.state === 'ask')?.id ?? null)
  }

  if (teams.length === 0) {
    return (
      <p className="px-1 py-2 text-[11px] text-muted-foreground">
        {translate('dashboardPopout.graph.empty', 'No agents to show')}
      </p>
    )
  }

  if (!openTeam) {
    return <TeamOverview teams={teams} onSelectTeam={selectTeam} />
  }

  return (
    <div data-testid="agent-team-open" className="flex w-full min-w-0 gap-6">
      <TeamRail
        team={openTeam}
        teams={teams}
        selected={selected}
        onBack={() => setOpenTeamId(null)}
        onSelectTeam={selectTeam}
        onOpenTerminal={onOpenTerminal}
      />
      <div className="min-w-0 flex-1">
        <TeamStage
          key={openTeam.id}
          team={openTeam}
          selectedId={selected?.id ?? null}
          onSelectMember={(member) => setSelectedId(member.id)}
          onOpenTerminal={onOpenTerminal}
        />
      </div>
    </div>
  )
}
