import React from 'react'
import type AgentCombobox from '@/components/agent/AgentCombobox'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { isAutonomousGoalAgent } from '../../../../shared/autonomous-goal-types'
import {
  findOrchestrationAgent,
  listOrchestrationAgents
} from '../../../../shared/orchestration-agent-profiles'
import {
  applyOrchestrationAgentToDraft,
  autonomousGoalDraftBlocksCreate,
  type AutonomousGoalDraft,
  type ComposerWizardStep
} from '@/lib/autonomous-goal-draft'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'
import { NewWorkspaceComposerAutonomousSection } from './NewWorkspaceComposerAutonomousSection'
import { useLocalOnlyGoalBase } from './use-local-only-goal-base'
import {
  ComposerInstructionsStep,
  ComposerModePicker,
  ComposerOrchestrationAgentPicker,
  ComposerWizardStepper
} from './composer-wizard-steps'

type AgentEntries = React.ComponentProps<typeof AgentCombobox>['agents']

export type ComposerWizardNav = {
  onBack?: () => void
  /** Present on a step that advances; absent where the footer creates. */
  onNext?: () => void
  nextDisabled: boolean
}

export type ComposerWizard = {
  /** False when the host passes no draft: the card keeps its single-page layout. */
  active: boolean
  step: ComposerWizardStep
  stepper: React.ReactNode
  showBasics: boolean
  showAgentSection: boolean
  /** Rendered before the agent section (mode cards, orchestration agent). */
  beforeAgent: React.ReactNode
  /** Rendered inside the agent section, before Advanced (the goal fields). */
  goalSection: React.ReactNode
  /** Rendered after everything on the step (step 4). */
  afterAgent: React.ReactNode
  agents: AgentEntries
  agentLabel?: string
  nav: ComposerWizardNav | null
}

/**
 * The composer as steps: basics, then the mode, then (Orchestration only) the orchestration
 * agent with the goal and, last, extra instructions. The Worktree mode creates from step 2.
 */
export function useComposerGoalMode(
  props: Pick<
    NewWorkspaceComposerCardProps,
    | 'autonomousGoalDraft'
    | 'onAutonomousGoalDraftChange'
    | 'orchestrationUnavailable'
    | 'quickAgent'
    | 'onQuickAgentChange'
    | 'repoId'
    | 'baseBranch'
  >,
  visibleQuickAgents: AgentEntries
): ComposerWizard {
  const { autonomousGoalDraft: draft, onAutonomousGoalDraftChange: onDraftChange } = props
  const customAgents = useAppStore((state) => state.settings?.orchestrationAgents)
  const orchestrationAgents = React.useMemo(
    () => listOrchestrationAgents(customAgents),
    [customAgents]
  )
  const goalAgents = React.useMemo(
    () => visibleQuickAgents.filter((entry) => isAutonomousGoalAgent(entry.id)),
    [visibleQuickAgents]
  )
  // Why the whole catalog: workers start on the goal's host, which may have agents this machine
  // does not, and a picked agent's worker must show instead of a blank entry.
  const workerAgents = React.useMemo(
    () => getAgentCatalog().filter((entry) => isAutonomousGoalAgent(entry.id)),
    []
  )
  const orchestration = draft?.enabled === true && props.orchestrationUnavailable !== true
  const localOnlyBase = useLocalOnlyGoalBase(
    props.repoId,
    props.baseBranch,
    orchestration && draft?.step === 3
  )
  if (!draft || !onDraftChange) {
    return {
      active: false,
      step: 1,
      stepper: null,
      showBasics: true,
      showAgentSection: true,
      beforeAgent: null,
      goalSection: null,
      afterAgent: null,
      agents: visibleQuickAgents,
      nav: null
    }
  }
  const goTo = (step: ComposerWizardStep): void => onDraftChange({ ...draft, step })
  const selectedAgent = findOrchestrationAgent(customAgents, draft.agentId)
  const applyAgent = (next: AutonomousGoalDraft, agentId: string): void => {
    const agent = findOrchestrationAgent(customAgents, agentId)
    onDraftChange(applyOrchestrationAgentToDraft(next, agent))
    props.onQuickAgentChange(agent.coordinatorAgent)
  }
  const selectMode = (nextOrchestration: boolean): void => {
    const next = { ...draft, enabled: nextOrchestration }
    if (nextOrchestration && !isAutonomousGoalAgent(props.quickAgent)) {
      // Why: only goal agents can coordinate, so Orchestration never keeps one that cannot.
      applyAgent(next, next.agentId)
      return
    }
    onDraftChange(next)
  }
  const step = draft.step
  const coordinatorSupported = isAutonomousGoalAgent(props.quickAgent)
  const stepper = <ComposerWizardStepper step={step} orchestration={orchestration} />
  const base: Omit<ComposerWizard, 'showAgentSection' | 'nav'> = {
    active: true,
    step,
    stepper,
    showBasics: step === 1,
    beforeAgent: null,
    goalSection: null,
    afterAgent: null,
    agents: visibleQuickAgents
  }
  if (step === 1) {
    return {
      ...base,
      showAgentSection: false,
      nav: { onNext: () => goTo(2), nextDisabled: !props.repoId }
    }
  }
  if (step === 2 || !orchestration) {
    return {
      ...base,
      step: 2,
      // Why: the Worktree mode keeps its one-step create, with the agent picked right here.
      showAgentSection: !orchestration,
      beforeAgent: (
        <ComposerModePicker
          orchestration={orchestration}
          orchestrationUnavailable={props.orchestrationUnavailable === true}
          onSelect={selectMode}
        />
      ),
      nav: {
        onBack: () => goTo(1),
        ...(orchestration ? { onNext: () => goTo(3) } : {}),
        nextDisabled: false
      }
    }
  }
  const coordinatorLabel = translate(
    'auto.components.NewWorkspaceComposerGoalMode.coordinatorAgent',
    'Coordinator agent'
  )
  if (step === 3) {
    return {
      ...base,
      showAgentSection: true,
      agents: goalAgents,
      agentLabel: coordinatorLabel,
      beforeAgent: (
        <ComposerOrchestrationAgentPicker
          agents={orchestrationAgents}
          value={selectedAgent.id}
          coordinatorAgent={props.quickAgent}
          onChange={(agent) => applyAgent(draft, agent.id)}
        />
      ),
      goalSection: (
        <NewWorkspaceComposerAutonomousSection
          draft={draft}
          onDraftChange={onDraftChange}
          coordinatorSupported={coordinatorSupported}
          workerAgents={workerAgents}
          localOnlyBase={localOnlyBase ? props.baseBranch : undefined}
        />
      ),
      nav: {
        onBack: () => goTo(2),
        onNext: () => goTo(4),
        // Why: step 4 only adds text, so the goal must already be launchable here.
        nextDisabled: autonomousGoalDraftBlocksCreate({ ...draft, step: 4 }, props.quickAgent)
      }
    }
  }
  return {
    ...base,
    showAgentSection: false,
    afterAgent: (
      <ComposerInstructionsStep
        draft={draft}
        onDraftChange={onDraftChange}
        summary={translate(
          'auto.components.ComposerWizard.summary',
          '{{agent}} · {{coordinator}} coordinates · {{parallel}} {{worker}} workers',
          {
            agent: selectedAgent.name,
            coordinator: props.quickAgent ?? '',
            parallel: draft.maxConcurrent,
            worker: draft.workerAgent
          }
        )}
      />
    ),
    nav: { onBack: () => goTo(3), nextDisabled: false }
  }
}
