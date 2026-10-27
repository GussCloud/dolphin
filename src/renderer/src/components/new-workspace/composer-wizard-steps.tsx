import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS } from '../../../../shared/autonomous-goal-types'
import {
  DEFAULT_ORCHESTRATION_AGENT_ID,
  type OrchestrationAgentProfile
} from '../../../../shared/orchestration-agent-profiles'
import type { AutonomousGoalDraft, ComposerWizardStep } from '@/lib/autonomous-goal-draft'

function stepLabels(): string[] {
  return [
    translate('auto.components.ComposerWizard.stepBasics', 'Basics'),
    translate('auto.components.ComposerWizard.stepMode', 'Mode'),
    translate('auto.components.ComposerWizard.stepAgent', 'Agent'),
    translate('auto.components.ComposerWizard.stepInstructions', 'Instructions')
  ]
}

/** Steps 3 and 4 exist only in the Orchestration mode, so the Worktree mode shows two. */
export function ComposerWizardStepper({
  step,
  orchestration
}: {
  step: ComposerWizardStep
  orchestration: boolean
}): React.JSX.Element {
  const labels = stepLabels().slice(0, orchestration ? 4 : 2)
  return (
    <ol
      className={cn('grid gap-2 text-xs', orchestration ? 'grid-cols-4' : 'grid-cols-2')}
      aria-label={translate('auto.components.ComposerWizard.steps', 'Steps')}
    >
      {labels.map((label, index) => {
        const number = index + 1
        return (
          <li
            key={label}
            aria-current={number === step ? 'step' : undefined}
            data-composer-wizard-step={number}
            className="border-t-2 border-border pt-2 text-muted-foreground aria-[current=step]:border-foreground aria-[current=step]:font-medium aria-[current=step]:text-foreground"
          >
            {number} {label}
          </li>
        )
      })}
    </ol>
  )
}

function ModeCard({
  pressed,
  disabled,
  title,
  description,
  onSelect
}: {
  pressed: boolean
  disabled?: boolean
  title: string
  description: string
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onSelect}
      className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border p-3 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-foreground/60 aria-pressed:bg-accent"
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

export function ComposerModePicker({
  orchestration,
  orchestrationUnavailable,
  onSelect
}: {
  orchestration: boolean
  /** Folder and multi-project targets have no single worktree terminal to coordinate from. */
  orchestrationUnavailable: boolean
  onSelect: (orchestration: boolean) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {translate('auto.components.ComposerWizard.modeQuestion', 'How should this worktree work?')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2" data-composer-mode-picker>
        <ModeCard
          pressed={!orchestration}
          title={translate('auto.components.ComposerWizard.worktreeMode', 'Worktree')}
          description={translate(
            'auto.components.ComposerWizard.worktreeModeDescription',
            'One agent works in this worktree, as usual.'
          )}
          onSelect={() => onSelect(false)}
        />
        <ModeCard
          pressed={orchestration}
          disabled={orchestrationUnavailable}
          title={translate('auto.components.ComposerWizard.orchestrationMode', 'Orchestration')}
          description={
            orchestrationUnavailable
              ? translate(
                  'auto.components.ComposerWizard.orchestrationUnavailable',
                  'Needs a single Git project; folder and multi-project workspaces cannot coordinate workers.'
                )
              : translate(
                  'auto.components.ComposerWizard.orchestrationModeDescription',
                  'An orchestration agent plans the goal, starts worktrees in parallel and follows the workers until every PR is merged.'
                )
          }
          onSelect={() => onSelect(true)}
        />
      </div>
    </div>
  )
}

export function ComposerOrchestrationAgentPicker({
  agents,
  value,
  coordinatorAgent,
  onChange
}: {
  agents: OrchestrationAgentProfile[]
  value: string
  /** The coordinator in use; differs from the agent's when that one is not available here. */
  coordinatorAgent: string | null
  onChange: (agent: OrchestrationAgentProfile) => void
}): React.JSX.Element {
  const selected = agents.find((agent) => agent.id === value) ?? agents[0]
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">
        {translate('auto.components.ComposerWizard.orchestrationAgent', 'Orchestration agent')}
      </span>
      <Select
        value={selected?.id}
        onValueChange={(id) => {
          const agent = agents.find((candidate) => candidate.id === id)
          if (agent) {
            onChange(agent)
          }
        }}
      >
        <SelectTrigger className="h-9 w-full" data-composer-orchestration-agent>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
              {agent.id === DEFAULT_ORCHESTRATION_AGENT_ID ? (
                <Badge variant="outline">
                  {translate('auto.components.settings.OrchestrationAgents.default', 'default')}
                </Badge>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.description ? (
        <p className="text-xs text-muted-foreground">{selected.description}</p>
      ) : null}
      {selected && coordinatorAgent && selected.coordinatorAgent !== coordinatorAgent ? (
        <p className="text-xs text-muted-foreground" data-composer-coordinator-differs>
          {translate(
            'auto.components.ComposerWizard.coordinatorDiffers',
            'This agent prefers {{preferred}} as coordinator; {{current}} coordinates this one.',
            { preferred: selected.coordinatorAgent, current: coordinatorAgent }
          )}
        </p>
      ) : null}
    </div>
  )
}

export function ComposerInstructionsStep({
  draft,
  onDraftChange,
  summary
}: {
  draft: AutonomousGoalDraft
  onDraftChange: (next: AutonomousGoalDraft) => void
  summary: string
}): React.JSX.Element {
  const id = React.useId()
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {translate(
            'auto.components.ComposerWizard.instructions',
            'Additional instructions (optional)'
          )}
        </label>
        <Textarea
          id={id}
          rows={5}
          value={draft.instructions}
          maxLength={AUTONOMOUS_GOAL_GUIDANCE_MAX_CHARS}
          placeholder={translate(
            'auto.components.ComposerWizard.instructionsPlaceholder',
            'e.g. Do not run tests locally; leave validation to CI.'
          )}
          onChange={(event) => onDraftChange({ ...draft, instructions: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.ComposerWizard.instructionsHint',
            'The coordinator passes them to every worker and keeps them across session rotations.'
          )}
        </p>
      </div>
      <p
        className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
        data-composer-orchestration-summary
      >
        {summary}
      </p>
    </div>
  )
}
