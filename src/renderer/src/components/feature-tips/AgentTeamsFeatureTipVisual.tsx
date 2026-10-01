import { useEffect, useState, type JSX, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { usePrefersReducedMotion } from '@/components/feature-wall/feature-wall-modal-helpers'
import { translate } from '@/i18n/i18n'

export type AgentTeamsDemoPhase =
  | 'idle'
  | 'typing'
  | 'planning'
  | 'firstTeammate'
  | 'secondTeammate'
  | 'working'
  | 'done'

type DemoState = { phase: AgentTeamsDemoPhase; chars: number }

// Per-step delay; typing advances one character per step.
const PHASE_MS: Record<AgentTeamsDemoPhase, number> = {
  idle: 900,
  typing: 38,
  planning: 1000,
  firstTeammate: 800,
  secondTeammate: 900,
  working: 2400,
  done: 2600
}
const LINE_STAGGER_MS = 420

export function nextAgentTeamsDemoState(state: DemoState, promptLength: number): DemoState {
  switch (state.phase) {
    case 'idle':
      return { phase: 'typing', chars: 0 }
    case 'typing':
      return state.chars < promptLength
        ? { ...state, chars: state.chars + 1 }
        : { ...state, phase: 'planning' }
    case 'planning':
      return { ...state, phase: 'firstTeammate' }
    case 'firstTeammate':
      return { ...state, phase: 'secondTeammate' }
    case 'secondTeammate':
      return { ...state, phase: 'working' }
    case 'working':
      return { ...state, phase: 'done' }
    case 'done':
      return { phase: 'idle', chars: 0 }
  }
}

const PHASE_ORDER: readonly AgentTeamsDemoPhase[] = [
  'idle',
  'typing',
  'planning',
  'firstTeammate',
  'secondTeammate',
  'working',
  'done'
]

function reached(phase: AgentTeamsDemoPhase, target: AgentTeamsDemoPhase): boolean {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(target)
}

function DemoLine({
  index = 0,
  done = false,
  children
}: {
  index?: number
  done?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <div
      className="flex min-w-0 items-start gap-1.5 animate-in fade-in-0 slide-in-from-bottom-1 [animation-fill-mode:both] motion-reduce:animate-none"
      style={{ animationDelay: `${index * LINE_STAGGER_MS}ms` }}
    >
      {done ? (
        <Check className="mt-0.5 size-3 shrink-0 text-status-success" />
      ) : (
        <span className="shrink-0 text-muted-foreground">●</span>
      )}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

function DemoPane({
  name,
  shell,
  active = false,
  children
}: {
  name: string
  shell?: string
  active?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <div
      data-active={active}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border/80 bg-[var(--editor-surface)] data-[active=true]:border-primary/60"
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border px-2 text-[10px] text-muted-foreground">
        <span
          data-active={active}
          className="size-1.5 shrink-0 rounded-full bg-foreground/35 data-[active=true]:bg-primary"
        />
        <span className="truncate font-medium text-foreground">{name}</span>
        {shell ? <span className="ml-auto shrink-0">{shell}</span> : null}
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden px-2.5 py-2 font-mono text-[11px] leading-snug text-foreground">
        {children}
      </div>
    </div>
  )
}

export function AgentTeamsFeatureTipVisual(): JSX.Element {
  const reducedMotion = usePrefersReducedMotion()
  const prompt = translate(
    'featureTips.agentTeams.demoPrompt',
    'Create a team: one teammate on the API, one on tests.'
  )
  const [state, setState] = useState<DemoState>({ phase: 'idle', chars: 0 })
  // Why: reduced motion freezes on the finished team instead of looping.
  const shown: DemoState = reducedMotion ? { phase: 'done', chars: prompt.length } : state
  const { phase } = shown

  useEffect(() => {
    if (reducedMotion) {
      return
    }
    const timeoutId = window.setTimeout(
      () => setState((current) => nextAgentTeamsDemoState(current, prompt.length)),
      // Why: a beat after the last keystroke before the lead answers.
      state.phase === 'typing' && state.chars === prompt.length
        ? PHASE_MS.typing * 12
        : PHASE_MS[state.phase]
    )
    return () => window.clearTimeout(timeoutId)
  }, [prompt.length, reducedMotion, state])

  // Why: on Windows teammate panes run in Git Bash; the lead keeps the user's own shell.
  const shell = translate('featureTips.agentTeams.demoShell', 'Git Bash')

  return (
    <div
      className="relative flex h-full min-h-[23rem] flex-col items-center justify-center overflow-hidden px-5 py-7"
      aria-hidden="true"
    >
      <div className="flex h-[21rem] w-full max-w-[27rem] flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-left shadow-xs">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[11px] text-muted-foreground">
          <span className="size-2 rounded-full bg-foreground/35" />
          <span className="truncate">
            {translate('featureTips.agentTeams.demoTabTitle', 'Claude Agent Teams')}
          </span>
        </div>

        {/* Why: grid tracks animate from 0fr so panes grow in place, like the real split. */}
        <div
          data-split={reached(phase, 'firstTeammate')}
          className="grid min-h-0 flex-1 grid-cols-[1fr_0fr] gap-0 p-1.5 transition-[grid-template-columns,gap] duration-500 ease-out data-[split=true]:grid-cols-[1fr_1fr] data-[split=true]:gap-1.5 motion-reduce:transition-none"
        >
          <DemoPane
            name={translate('featureTips.agentTeams.demoLead', 'lead')}
            active={phase === 'typing' || phase === 'planning' || phase === 'done'}
          >
            <div className="flex min-w-0 gap-1.5">
              <span className="shrink-0 text-muted-foreground">›</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {prompt.slice(0, shown.chars)}
                {phase === 'idle' || phase === 'typing' ? (
                  <span className="ml-px inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-foreground/70 motion-reduce:animate-none" />
                ) : null}
              </span>
            </div>
            {reached(phase, 'planning') ? (
              <DemoLine>
                {translate(
                  'featureTips.agentTeams.demoPlanning',
                  'Creating a team with 2 teammates'
                )}
              </DemoLine>
            ) : null}
            {phase === 'done' ? (
              <DemoLine done>
                {translate('featureTips.agentTeams.demoLeadDone', 'Both teammates reported back')}
              </DemoLine>
            ) : null}
          </DemoPane>

          <div
            data-split={reached(phase, 'secondTeammate')}
            className="grid min-h-0 min-w-0 grid-rows-[1fr_0fr] gap-0 overflow-hidden transition-[grid-template-rows,gap] duration-500 ease-out data-[split=true]:grid-rows-[1fr_1fr] data-[split=true]:gap-1.5 motion-reduce:transition-none"
          >
            <DemoPane
              name={translate('featureTips.agentTeams.demoApiTeammate', 'api')}
              shell={shell}
              active={phase === 'working'}
            >
              {reached(phase, 'working') ? (
                <>
                  <DemoLine index={0}>
                    {translate('featureTips.agentTeams.demoApiRead', 'Reading routes.ts')}
                  </DemoLine>
                  <DemoLine index={1}>
                    {translate('featureTips.agentTeams.demoApiEdit', 'Adding input checks')}
                  </DemoLine>
                </>
              ) : null}
              {phase === 'done' ? (
                <DemoLine done>
                  {translate('featureTips.agentTeams.demoApiDone', 'Sent summary to lead')}
                </DemoLine>
              ) : null}
            </DemoPane>
            <DemoPane
              name={translate('featureTips.agentTeams.demoTestsTeammate', 'tests')}
              shell={shell}
              active={phase === 'working'}
            >
              {reached(phase, 'working') ? (
                <>
                  <DemoLine index={1}>
                    {translate('featureTips.agentTeams.demoTestsWrite', 'Writing routes.test.ts')}
                  </DemoLine>
                  <DemoLine index={2}>
                    {translate('featureTips.agentTeams.demoTestsRun', 'Running 12 tests')}
                  </DemoLine>
                </>
              ) : null}
              {phase === 'done' ? (
                <DemoLine done>
                  {translate('featureTips.agentTeams.demoTestsDone', '12 passed')}
                </DemoLine>
              ) : null}
            </DemoPane>
          </div>
        </div>
      </div>
    </div>
  )
}
