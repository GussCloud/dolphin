import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import type AgentCombobox from '@/components/agent/AgentCombobox'
import { isAutonomousGoalAgent } from '../../../../shared/autonomous-goal-types'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'
import { NewWorkspaceComposerAutonomousSection } from './NewWorkspaceComposerAutonomousSection'
import { useLocalOnlyGoalBase } from './use-local-only-goal-base'

type AgentEntries = React.ComponentProps<typeof AgentCombobox>['agents']

/**
 * The composer's two launch modes as tabs: a plain worktree, or an autonomous goal whose fields
 * apply only while its tab is active. The goal tab offers only agents that can coordinate.
 */
export function useComposerGoalMode(
  props: Pick<
    NewWorkspaceComposerCardProps,
    | 'autonomousGoalDraft'
    | 'onAutonomousGoalDraftChange'
    | 'quickAgent'
    | 'onQuickAgentChange'
    | 'repoId'
    | 'baseBranch'
  >,
  visibleQuickAgents: AgentEntries
): {
  tabs: React.ReactNode
  goalSection: React.ReactNode
  agents: AgentEntries
  agentLabel?: string
} {
  const { autonomousGoalDraft: draft, onAutonomousGoalDraftChange: onDraftChange } = props
  const goalAgents = React.useMemo(
    () => visibleQuickAgents.filter((entry) => isAutonomousGoalAgent(entry.id)),
    [visibleQuickAgents]
  )
  const localOnlyBase = useLocalOnlyGoalBase(
    props.repoId,
    props.baseBranch,
    draft?.enabled === true && onDraftChange !== undefined
  )
  if (!draft || !onDraftChange) {
    return { tabs: null, goalSection: null, agents: visibleQuickAgents }
  }
  const selectMode = (mode: string): void => {
    const enabled = mode === 'autonomous'
    onDraftChange({ ...draft, enabled })
    // Why: only goal agents can coordinate, so the goal tab never keeps one that cannot.
    if (enabled && !isAutonomousGoalAgent(props.quickAgent) && goalAgents[0]) {
      props.onQuickAgentChange(goalAgents[0].id)
    }
  }
  const tabs = (
    <Tabs value={draft.enabled ? 'autonomous' : 'worktree'} onValueChange={selectMode}>
      <TabsList className="w-full">
        <TabsTrigger value="worktree">
          {translate('auto.components.NewWorkspaceComposerGoalMode.worktreeTab', 'Worktree')}
        </TabsTrigger>
        <TabsTrigger value="autonomous">
          {translate(
            'auto.components.NewWorkspaceComposerGoalMode.autonomousTab',
            'Autonomous work'
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
  if (!draft.enabled) {
    return { tabs, goalSection: null, agents: visibleQuickAgents }
  }
  return {
    tabs,
    agents: goalAgents,
    agentLabel: translate(
      'auto.components.NewWorkspaceComposerGoalMode.coordinatorAgent',
      'Coordinator agent'
    ),
    goalSection: (
      <NewWorkspaceComposerAutonomousSection
        draft={draft}
        onDraftChange={onDraftChange}
        coordinatorSupported={isAutonomousGoalAgent(props.quickAgent)}
        workerAgents={goalAgents}
        localOnlyBase={localOnlyBase ? props.baseBranch : undefined}
      />
    )
  }
}
