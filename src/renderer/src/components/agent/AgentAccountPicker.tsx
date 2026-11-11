import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type {
  WorktreeAccountAgent,
  WorktreeAgentAccountChoice
} from '../../../../shared/worktree-agent-account'

// Radix Select forbids an empty item value, so "no pin" needs a sentinel.
const ACTIVE_ACCOUNT_VALUE = '__active-account__'

export type AgentAccountPickerProps = {
  agent: WorktreeAccountAgent
  choices: readonly WorktreeAgentAccountChoice[]
  /** Null keeps the runtime's active account, or the project's default when one is set. */
  value: string | null
  /** The project's default account, which a null value inherits. */
  inheritedChoice?: WorktreeAgentAccountChoice | null
  onValueChange: (accountId: string | null) => void
}

export function AgentAccountPicker({
  agent,
  choices,
  value,
  onValueChange,
  inheritedChoice
}: AgentAccountPickerProps): React.JSX.Element {
  // Why: a pick that vanished (account removed while open) must not submit a stale id.
  const selectedValue =
    value && choices.some((choice) => choice.id === value) ? value : ACTIVE_ACCOUNT_VALUE
  return (
    <div className="min-w-0 space-y-1" data-agent-account-picker={agent}>
      <label className="text-xs font-medium text-muted-foreground">
        {translate('auto.components.agent.AgentAccountPicker.label', 'Account')}
      </label>
      <Select
        value={selectedValue}
        onValueChange={(next) => onValueChange(next === ACTIVE_ACCOUNT_VALUE ? null : next)}
      >
        <SelectTrigger className="h-9 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ACTIVE_ACCOUNT_VALUE}>
            {inheritedChoice
              ? translate(
                  'auto.components.agent.AgentAccountPicker.projectDefault',
                  'Project account ({{value0}})',
                  { value0: inheritedChoice.email }
                )
              : translate('auto.components.agent.AgentAccountPicker.active', 'Active account')}
          </SelectItem>
          {choices.map((choice) => (
            <SelectItem key={choice.id} value={choice.id}>
              <span className="truncate">{choice.email}</span>
              {choice.workspaceLabel ? (
                <span className="truncate text-muted-foreground">{choice.workspaceLabel}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
