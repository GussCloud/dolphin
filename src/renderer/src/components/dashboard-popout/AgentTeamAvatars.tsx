import { memo } from 'react'
import { Check } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { cn } from '@/lib/utils'
import {
  ORBIT_LEADER_SIZE,
  ORBIT_MEMBER_SIZE,
  memberInitials,
  teamRingArcs,
  type AgentTeam,
  type AgentTeamMember,
  type AgentTeamMemberState
} from './agent-team-orbit-model'

export const MEMBER_STATE_STROKE: Record<AgentTeamMemberState, string> = {
  ask: 'stroke-agent-question',
  working: 'stroke-status-warning',
  done: 'stroke-status-success',
  idle: 'stroke-muted-foreground/40'
}

const MEMBER_STATE_BORDER: Record<AgentTeamMemberState, string> = {
  ask: 'border-agent-question',
  working: 'border-status-warning/50',
  done: 'border-status-success',
  idle: 'border-muted-foreground/40'
}

export const MEMBER_STATE_TEXT: Record<AgentTeamMemberState, string> = {
  ask: 'text-agent-question',
  working: 'text-status-warning',
  done: 'text-status-success',
  idle: 'text-muted-foreground'
}

const RING_STROKE = { lg: 6, sm: 3 } as const
const RING_SIZE = { lg: ORBIT_LEADER_SIZE, sm: 40 } as const

function TeamRing({ team, size }: { team: AgentTeam; size: 'lg' | 'sm' }): React.JSX.Element {
  const box = RING_SIZE[size]
  const stroke = RING_STROKE[size]
  return (
    <svg
      aria-hidden
      className="absolute inset-0"
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
    >
      <circle
        cx={box / 2}
        cy={box / 2}
        r={box / 2 - stroke / 2}
        fill="none"
        strokeWidth={stroke}
        className="stroke-muted"
      />
      {teamRingArcs(team, box, stroke).map((arc, index) => (
        <path
          key={index}
          d={arc.d}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={MEMBER_STATE_STROKE[arc.state]}
        />
      ))}
    </svg>
  )
}

/** A lead agent: its own icon inside a ring with one arc per teammate. */
export const AgentTeamLeaderAvatar = memo(function AgentTeamLeaderAvatar({
  team,
  size,
  label,
  onClick
}: {
  team: AgentTeam
  size: 'lg' | 'sm'
  label: string
  onClick: () => void
}): React.JSX.Element {
  const box = RING_SIZE[size]
  const done = team.counts.done
  return (
    <button
      type="button"
      data-testid="agent-team-leader"
      aria-label={label}
      onClick={onClick}
      style={{ width: box, height: box }}
      className="group relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {team.leaderState === 'working' && size === 'lg' ? (
        <span
          aria-hidden
          className="agent-orbit-breathe absolute inset-1 rounded-full bg-status-warning-background opacity-0"
        />
      ) : null}
      <TeamRing team={team} size={size} />
      <span
        className={cn(
          'absolute flex flex-col items-center justify-center gap-1 rounded-full border border-border bg-card transition-colors group-hover:border-foreground/25',
          size === 'lg' ? 'inset-[18px]' : 'inset-[6px]'
        )}
      >
        <AgentIcon
          agent={agentTypeToIconAgent(team.leader.agentType)}
          size={size === 'lg' ? 28 : 14}
        />
        {size === 'lg' && team.members.length > 0 ? (
          <span className="font-mono text-[14px] font-semibold tabular-nums text-foreground">
            {`${done}/${team.members.length}`}
          </span>
        ) : null}
      </span>
      {size === 'lg' && team.members.length > 0 ? (
        <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-accent px-1.5 text-[11px] font-semibold text-foreground">
          {team.members.length}
        </span>
      ) : null}
      {team.needsYou ? (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full border-2 border-background bg-agent-question font-bold text-background',
            size === 'lg'
              ? 'top-2 left-2 size-6 text-[12px]'
              : '-top-0.5 -left-0.5 size-4 text-[9px]'
          )}
        >
          ?
        </span>
      ) : null}
    </button>
  )
})

/** A teammate or in-process subagent orbiting its lead. */
export const AgentTeamMemberAvatar = memo(function AgentTeamMemberAvatar({
  member,
  selected
}: {
  member: AgentTeamMember
  selected: boolean
}): React.JSX.Element {
  return (
    <span
      className="relative block"
      style={{ width: ORBIT_MEMBER_SIZE, height: ORBIT_MEMBER_SIZE }}
    >
      {member.state === 'working' ? (
        <span
          aria-hidden
          className="agent-orbit-spin absolute -inset-1 rounded-full border-[2.5px] border-status-warning/20 border-t-status-warning"
        />
      ) : null}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-full border-[2.5px] bg-card text-[15px] font-semibold text-foreground',
          member.kind === 'subagent' && 'border-dashed',
          MEMBER_STATE_BORDER[member.state],
          selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
        )}
      >
        {memberInitials(member.name)}
      </span>
      {member.state === 'done' ? (
        <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-status-success text-background">
          <Check className="size-3" />
        </span>
      ) : member.state === 'ask' ? (
        <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-agent-question text-[11px] font-bold text-background">
          ?
        </span>
      ) : null}
    </span>
  )
})
