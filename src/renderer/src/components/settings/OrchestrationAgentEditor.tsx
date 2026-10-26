import React from 'react'
import AgentCombobox from '@/components/agent/AgentCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  AUTONOMOUS_GOAL_AGENT_NAME_MAX_CHARS,
  AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS,
  AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT,
  isAutonomousGoalAgent
} from '../../../../shared/autonomous-goal-types'
import {
  ORCHESTRATION_AGENT_DESCRIPTION_MAX_CHARS,
  type OrchestrationAgentProfile
} from '../../../../shared/orchestration-agent-profiles'

const CONCURRENCY_OPTIONS = Array.from({ length: AUTONOMOUS_GOAL_MAX_CONCURRENT_LIMIT }, (_, i) =>
  String(i + 1)
)

type GoalAgentEntries = React.ComponentProps<typeof AgentCombobox>['agents']

/** Edits one user-made agent; text fields commit on blur so typing does not rewrite settings. */
export function OrchestrationAgentEditor({
  agent,
  goalAgents,
  onChange,
  onDuplicate,
  onDelete
}: {
  agent: OrchestrationAgentProfile
  goalAgents: GoalAgentEntries
  onChange: (next: OrchestrationAgentProfile) => void
  onDuplicate: () => void
  onDelete: () => void
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(agent)
  React.useEffect(() => setDraft(agent), [agent])
  const commit = (): void => {
    if (draft.name.trim() && JSON.stringify(draft) !== JSON.stringify(agent)) {
      onChange(draft)
    }
  }
  const nameId = React.useId()
  const descriptionId = React.useId()
  const strategyId = React.useId()
  return (
    <div className="min-w-0 space-y-3" data-orchestration-agent-editor={agent.id}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor={nameId} className="text-xs font-medium text-muted-foreground">
            {translate('auto.components.settings.OrchestrationAgents.name', 'Name')}
          </label>
          <Input
            id={nameId}
            value={draft.name}
            maxLength={AUTONOMOUS_GOAL_AGENT_NAME_MAX_CHARS}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            onBlur={commit}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={descriptionId} className="text-xs font-medium text-muted-foreground">
            {translate('auto.components.settings.OrchestrationAgents.description', 'Description')}
          </label>
          <Input
            id={descriptionId}
            value={draft.description}
            maxLength={ORCHESTRATION_AGENT_DESCRIPTION_MAX_CHARS}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            onBlur={commit}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <AgentField
          label={translate(
            'auto.components.settings.OrchestrationAgents.coordinatorAgent',
            'Coordinator CLI'
          )}
          agents={goalAgents}
          value={draft.coordinatorAgent}
          onChange={(coordinatorAgent) => onChange({ ...draft, coordinatorAgent })}
        />
        <AgentField
          label={translate(
            'auto.components.settings.OrchestrationAgents.workerAgent',
            'Worker agent'
          )}
          agents={goalAgents}
          value={draft.workerAgent}
          onChange={(workerAgent) => onChange({ ...draft, workerAgent })}
        />
        <div className="min-w-0 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {translate(
              'auto.components.settings.OrchestrationAgents.maxConcurrent',
              'Parallel worktrees'
            )}
          </span>
          <Select
            value={String(draft.maxConcurrent)}
            onValueChange={(value) =>
              onChange({ ...draft, maxConcurrent: Number.parseInt(value, 10) })
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
      <div className="space-y-1">
        <label htmlFor={strategyId} className="text-xs font-medium text-muted-foreground">
          {translate(
            'auto.components.settings.OrchestrationAgents.strategy',
            'Strategy (the agent prompt)'
          )}
        </label>
        <Textarea
          id={strategyId}
          rows={6}
          value={draft.strategy}
          maxLength={AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS}
          placeholder={translate(
            'auto.components.settings.OrchestrationAgents.strategyPlaceholder',
            'e.g. Split the goal into Tasks of at most one day, each with a clear acceptance check.'
          )}
          onChange={(event) => setDraft({ ...draft, strategy: event.target.value })}
          onBlur={commit}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
          {translate('auto.components.settings.OrchestrationAgents.duplicate', 'Duplicate')}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          {translate('auto.components.settings.OrchestrationAgents.delete', 'Delete')}
        </Button>
      </div>
    </div>
  )
}

function AgentField({
  label,
  agents,
  value,
  onChange
}: {
  label: string
  agents: GoalAgentEntries
  value: OrchestrationAgentProfile['workerAgent']
  onChange: (agent: OrchestrationAgentProfile['workerAgent']) => void
}): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <AgentCombobox
        agents={agents}
        value={value}
        onValueChange={(agent) => {
          if (isAutonomousGoalAgent(agent)) {
            onChange(agent)
          }
        }}
        allowNarrowTrigger
        allowBlankTerminal={false}
        triggerClassName="h-9 w-full min-w-0 border-input text-sm"
      />
    </div>
  )
}
