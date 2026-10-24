import React from 'react'
import { Switch } from '@/components/ui/switch'
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
  AUTONOMOUS_GOAL_AGENTS,
  AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT,
  isAutonomousGoalAgent
} from '../../../../shared/autonomous-goal-types'
import { TUI_AGENT_DISPLAY_NAMES } from '../../../../shared/tui-agent-display-names'
import type { AutonomousGoalDraft } from '@/lib/autonomous-goal-draft'

const CONCURRENCY_OPTIONS = Array.from(
  { length: AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT },
  (_, index) => String(index + 1)
)

export function NewWorkspaceComposerAutonomousSection({
  draft,
  onDraftChange,
  coordinatorSupported
}: {
  draft: AutonomousGoalDraft
  onDraftChange: (next: AutonomousGoalDraft) => void
  /** Only goal agents can coordinate: rotation relies on their CLI's in-place session reset. */
  coordinatorSupported: boolean
}): React.JSX.Element {
  const switchId = React.useId()
  const objectiveId = React.useId()
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <label htmlFor={switchId} className="text-xs font-medium text-muted-foreground">
            {translate(
              'auto.components.NewWorkspaceComposerAutonomousSection.title',
              'Autonomous work'
            )}
          </label>
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
        </div>
        <Switch
          id={switchId}
          checked={draft.enabled && coordinatorSupported}
          disabled={!coordinatorSupported}
          onCheckedChange={(enabled) => onDraftChange({ ...draft, enabled })}
        />
      </div>
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
              <Select
                value={draft.workerAgent}
                onValueChange={(value) => {
                  if (isAutonomousGoalAgent(value)) {
                    onDraftChange({ ...draft, workerAgent: value })
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTONOMOUS_GOAL_AGENTS.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {TUI_AGENT_DISPLAY_NAMES[agent]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </div>
      ) : null}
    </div>
  )
}
