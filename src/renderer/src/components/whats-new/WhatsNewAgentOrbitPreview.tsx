import { useEffect, useMemo, useState, type JSX } from 'react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { DashboardCard, DashboardCardDotState } from '../../../../shared/dashboard-snapshot'
import {
  ORBIT_LEADER_SIZE,
  ORBIT_MEMBER_BOX_WIDTH,
  ORBIT_MEMBER_SIZE,
  buildAgentTeams,
  layoutTeamOrbit
} from '../dashboard-popout/agent-team-orbit-model'
import {
  AgentTeamLeaderAvatar,
  AgentTeamMemberAvatar,
  MEMBER_STATE_STROKE
} from '../dashboard-popout/AgentTeamAvatars'

const PREVIEW_WIDTH = 448
const LEAD_ONLY_MS = 1300
const ORBIT_HOLD_MS = 4200

function sampleCard(paneKey: string, name: string, dotState: DashboardCardDotState): DashboardCard {
  return {
    paneKey,
    ptyId: null,
    agentType: 'claude',
    bucket: dotState === 'done' ? 'done' : dotState === 'blocked' ? 'attention' : 'working',
    dotState,
    task: '',
    repoId: 'preview',
    worktreeId: 'preview',
    tabId: 'preview',
    leafId: null,
    repoName: '',
    worktreeName: name,
    conversationName: name,
    startedAt: 0,
    finishedAt: null,
    stateChangedAt: 0,
    unseen: false,
    ...(paneKey === 'lead' ? {} : { parentPaneKey: 'lead' })
  }
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Decorative loop of the dashboard team view: the lead alone, then its team popping into orbit. */
export function WhatsNewAgentOrbitPreview({ animate }: { animate: boolean }): JSX.Element {
  const team = useMemo(
    () =>
      buildAgentTeams([
        sampleCard(
          'lead',
          translate('whatsNew.agentTeams.sample.lead', 'Build the release'),
          'working'
        ),
        sampleCard('a', translate('whatsNew.agentTeams.sample.research', 'research'), 'working'),
        sampleCard('b', translate('whatsNew.agentTeams.sample.tests', 'tests'), 'done'),
        sampleCard('c', translate('whatsNew.agentTeams.sample.docs', 'docs'), 'blocked'),
        sampleCard('d', translate('whatsNew.agentTeams.sample.review', 'review'), 'done'),
        sampleCard('e', translate('whatsNew.agentTeams.sample.build', 'build'), 'working'),
        sampleCard('f', translate('whatsNew.agentTeams.sample.i18n', 'i18n'), 'done')
      ])[0],
    []
  )
  const layout = useMemo(() => layoutTeamOrbit(team.members), [team.members])
  const reducedMotion = useMemo(() => prefersReducedMotion(), [])
  const [cycle, setCycle] = useState(0)
  const [orbitVisible, setOrbitVisible] = useState(reducedMotion)

  useEffect(() => {
    if (!animate || reducedMotion) {
      return
    }
    setOrbitVisible(false)
    const showOrbit = setTimeout(() => setOrbitVisible(true), LEAD_ONLY_MS)
    const restart = setTimeout(() => setCycle((value) => value + 1), LEAD_ONLY_MS + ORBIT_HOLD_MS)
    return () => {
      clearTimeout(showOrbit)
      clearTimeout(restart)
    }
  }, [animate, reducedMotion, cycle])

  const scale = PREVIEW_WIDTH / layout.width
  const pointById = new Map(layout.members.map((point) => [point.id, point]))
  const askId = team.members.find((member) => member.state === 'ask')?.id

  return (
    <div
      aria-hidden
      inert
      data-testid="whats-new-orbit-preview"
      className="overflow-hidden rounded-lg border border-border bg-background"
      style={{ height: Math.round(layout.height * scale) + 8 }}
    >
      <div
        className="relative origin-top-left"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `scale(${scale})`,
          marginTop: 4
        }}
      >
        {orbitVisible ? (
          <svg
            key={`edges-${cycle}`}
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={layout.width}
            height={layout.height}
          >
            {layout.edges.map((edge, index) => {
              const state = team.members.find((member) => member.id === edge.id)?.state ?? 'idle'
              return (
                <g key={edge.id}>
                  <path
                    d={edge.d}
                    pathLength={1}
                    fill="none"
                    strokeWidth={state === 'ask' ? 2.5 : 2}
                    strokeLinecap="round"
                    style={{ animationDelay: `${index * 90}ms` }}
                    className={cn(
                      'agent-orbit-draw',
                      state === 'ask' ? 'stroke-agent-question/80' : 'stroke-border'
                    )}
                  />
                  {state === 'working' ? (
                    <path
                      d={edge.d}
                      fill="none"
                      strokeWidth={2}
                      strokeLinecap="round"
                      className={cn('agent-orbit-flow', MEMBER_STATE_STROKE.working)}
                    />
                  ) : null}
                </g>
              )
            })}
          </svg>
        ) : null}
        <div
          className="absolute"
          style={{
            left: layout.center.x - ORBIT_LEADER_SIZE / 2,
            top: layout.center.y - ORBIT_LEADER_SIZE / 2
          }}
        >
          <AgentTeamLeaderAvatar team={team} size="lg" label="" onClick={() => undefined} />
        </div>
        {orbitVisible
          ? team.members.map((member, index) => {
              const point = pointById.get(member.id)
              if (!point) {
                return null
              }
              return (
                <div
                  key={`${member.id}-${cycle}`}
                  className="agent-orbit-pop absolute flex flex-col items-center gap-1.5"
                  style={{
                    left: point.x - ORBIT_MEMBER_BOX_WIDTH / 2,
                    top: point.y - ORBIT_MEMBER_SIZE / 2,
                    width: ORBIT_MEMBER_BOX_WIDTH,
                    animationDelay: `${index * 90}ms`
                  }}
                >
                  <AgentTeamMemberAvatar member={member} selected={member.id === askId} />
                  <span className="max-w-full truncate text-[15px] font-semibold text-foreground">
                    {member.name}
                  </span>
                </div>
              )
            })
          : null}
      </div>
    </div>
  )
}
