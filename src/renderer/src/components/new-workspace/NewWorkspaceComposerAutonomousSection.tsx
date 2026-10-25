import React from 'react'
import { Switch } from '@/components/ui/switch'
import AgentCombobox from '@/components/agent/AgentCombobox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT,
  isAutonomousGoalAgent
} from '../../../../shared/autonomous-goal-types'
import type { AutonomousGoalDraft } from '@/lib/autonomous-goal-draft'

const CONCURRENCY_OPTIONS = Array.from(
  { length: AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT },
  (_, index) => String(index + 1)
)

export function NewWorkspaceComposerAutonomousSection({
  draft,
  onDraftChange,
  coordinatorSupported,
  workerAgents
}: {
  draft: AutonomousGoalDraft
  onDraftChange: (next: AutonomousGoalDraft) => void
  /** Only goal agents can coordinate: rotation relies on their CLI's in-place session reset. */
  coordinatorSupported: boolean
  workerAgents: React.ComponentProps<typeof AgentCombobox>['agents']
}): React.JSX.Element {
  const objectiveId = React.useId()
  const removeWorktreesId = React.useId()
  const keepCoordinatorId = React.useId()
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs text-muted-foreground">
        {coordinatorSupported
          ? translate(
              'auto.components.NewWorkspaceComposerAutonomousSection.description',
              'The agent plans the goal, starts worktrees in parallel and coordinates them until every PR is merged.'
            )
          : translate(
              'auto.components.NewWorkspaceComposerAutonomousSection.unsupportedAgent',
              'Pick Claude, Codex or DeepSeek (Agent Teams works too) to coordinate autonomous work.'
            )}
      </p>
      {draft.enabled && coordinatorSupported ? (
        <div className="space-y-2">
          <label htmlFor={objectiveId} className="text-xs font-medium text-muted-foreground">
            {translate('auto.components.NewWorkspaceComposerAutonomousSection.objective', 'Goal')}
          </label>
          <Textarea
            id={objectiveId}
            value={draft.objective}
            rows={3}
            placeholder={translate(
              'auto.components.NewWorkspaceComposerAutonomousSection.objectivePlaceholder',
              'e.g. Read the docs folder and implement what it specifies'
            )}
            onChange={(event) => onDraftChange({ ...draft, objective: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {translate(
                  'auto.components.NewWorkspaceComposerAutonomousSection.workerAgent',
                  'Worker agent'
                )}
              </label>
              <AgentCombobox
                agents={workerAgents}
                value={draft.workerAgent}
                onValueChange={(agent) => {
                  if (isAutonomousGoalAgent(agent)) {
                    onDraftChange({ ...draft, workerAgent: agent })
                  }
                }}
                allowNarrowTrigger
                allowBlankTerminal={false}
                triggerClassName="h-9 w-full min-w-0 border-input text-sm"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {translate(
                  'auto.components.NewWorkspaceComposerAutonomousSection.maxConcurrent',
                  'Parallel worktrees'
                )}
              </label>
              <Select
                value={String(draft.maxConcurrent)}
                onValueChange={(value) =>
                  onDraftChange({ ...draft, maxConcurrent: Number.parseInt(value, 10) })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONCURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AutonomousCleanupSwitch
            id={removeWorktreesId}
            checked={draft.removeWorktrees}
            onCheckedChange={(removeWorktrees) => onDraftChange({ ...draft, removeWorktrees })}
            label={translate(
              'auto.components.NewWorkspaceComposerAutonomousSection.removeWorktrees',
              'Remove worktrees when done'
            )}
            description={translate(
              'auto.components.NewWorkspaceComposerAutonomousSection.removeWorktreesDescription',
              'Finished workers close their terminal, and their worktree is removed once its PR merges. When off, everything stays open.'
            )}
          />
          {draft.removeWorktrees ? (
            <AutonomousCleanupSwitch
              id={keepCoordinatorId}
              checked={draft.keepCoordinatorWorktree}
              onCheckedChange={(keepCoordinatorWorktree) =>
                onDraftChange({ ...draft, keepCoordinatorWorktree })
              }
              label={translate(
                'auto.components.NewWorkspaceComposerAutonomousSection.keepCoordinatorWorktree',
                'Keep main worktree'
              )}
              description={translate(
                'auto.components.NewWorkspaceComposerAutonomousSection.keepCoordinatorWorktreeDescription',
                "The coordinator's worktree stays after the goal completes."
              )}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function AutonomousCleanupSwitch({
  id,
  checked,
  onCheckedChange,
  label,
  description
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description: string
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
