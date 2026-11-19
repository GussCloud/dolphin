import React from 'react'
import type AgentCombobox from '@/components/agent/AgentCombobox'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { DESIGN_REQUEST_MAX_CHARS } from '../../../../shared/design-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import {
  designNameIsValid,
  isDesignAgent,
  type DesignDraft,
  type DesignDraftStep
} from '@/lib/design-draft'
import type { ComposerWizard } from './composer-goal-mode'
import { ComposerWizardStepper } from './composer-wizard-steps'

type AgentEntries = React.ComponentProps<typeof AgentCombobox>['agents']

export type ComposerDesignWizardInput = {
  draft: DesignDraft
  onDraftChange: (next: DesignDraft) => void
  name: string
  repoId: string
  quickAgent: TuiAgent | null
  onQuickAgentChange: (agent: TuiAgent | null) => void
  visibleQuickAgents: AgentEntries
  /** Folder and multi-project targets: no single worktree pane for the design agent. */
  targetUnavailable: boolean
}

function DesignRequestField({
  draft,
  onDraftChange
}: {
  draft: DesignDraft
  onDraftChange: (next: DesignDraft) => void
}): React.JSX.Element {
  const id = React.useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {translate('auto.components.ComposerDesign.requestLabel', 'What are we building today?')}
      </label>
      <Textarea
        id={id}
        rows={6}
        value={draft.request}
        maxLength={DESIGN_REQUEST_MAX_CHARS}
        placeholder={translate(
          'auto.components.ComposerDesign.requestPlaceholder',
          'Describe the feature: who uses it, what they do, and what should happen.'
        )}
        data-composer-design-request
        onChange={(event) => onDraftChange({ ...draft, request: event.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.ComposerDesign.requestHint',
          'The agent studies the project and draws the flow; nothing is built yet.'
        )}
      </p>
    </div>
  )
}

/** The Design flow as two steps: basics, then the request with the agent. No mode picker. */
export function buildComposerDesignWizard(input: ComposerDesignWizardInput): ComposerWizard {
  const { draft, onDraftChange } = input
  const designAgents = input.visibleQuickAgents.filter((entry) => isDesignAgent(entry.id))
  const goTo = (step: DesignDraftStep): void => onDraftChange({ ...draft, step })
  const stepper = (
    <ComposerWizardStepper
      step={draft.step}
      orchestration={false}
      labels={[
        translate('auto.components.ComposerWizard.stepBasics', 'Basics'),
        translate('auto.components.ComposerDesign.stepRequest', 'Request')
      ]}
    />
  )
  const base = {
    active: true,
    step: draft.step,
    stepper,
    goalSection: null,
    afterAgent: null,
    agents: designAgents,
    agentLabel: translate('auto.components.ComposerDesign.agentLabel', 'Design agent')
  }
  if (draft.step === 1) {
    return {
      ...base,
      showBasics: true,
      showAgentSection: false,
      beforeAgent: input.targetUnavailable ? (
        <p className="text-xs text-muted-foreground" data-composer-design-unavailable>
          {translate(
            'auto.components.ComposerDesign.targetUnavailable',
            'A design needs a single project; folder and multi-project workspaces are not supported.'
          )}
        </p>
      ) : null,
      nav: {
        onNext: () => {
          if (!isDesignAgent(input.quickAgent)) {
            // Why: only design agents are listed on step 2, so never land on one that is not.
            input.onQuickAgentChange(designAgents[0]?.id ?? null)
          }
          goTo(2)
        },
        nextDisabled: !input.repoId || input.targetUnavailable || !designNameIsValid(input.name)
      }
    }
  }
  return {
    ...base,
    showBasics: false,
    showAgentSection: true,
    beforeAgent: <DesignRequestField draft={draft} onDraftChange={onDraftChange} />,
    nav: { onBack: () => goTo(1), nextDisabled: false }
  }
}
