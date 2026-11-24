import React, { useId } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  BYPASS_REMOVAL_CATEGORIES,
  MOST_USED_BYPASS_REMOVAL_CATEGORIES,
  type AgentPermissionPolicy,
  type BypassRemovalCategory
} from '../../../../shared/agent-permission-policy'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { isAgentPermissionPolicyAvailable } from './agent-permission-policy-availability'

type PolicyChoice = 'ask' | 'catalog' | 'approve-all'

function toChoice(value: AgentPermissionPolicy | null): PolicyChoice {
  return value ? value.mode : 'ask'
}

function toPolicy(choice: PolicyChoice): AgentPermissionPolicy | null {
  if (choice === 'approve-all') {
    return { mode: 'approve-all' }
  }
  // Why empty: switching to the list must not approve anything the user did not check.
  return choice === 'catalog' ? { mode: 'catalog', categories: [] } : null
}

function isPolicyChoice(value: string): value is PolicyChoice {
  return value === 'ask' || value === 'catalog' || value === 'approve-all'
}

// Why: these targets are resolved only when the shell runs, so Dolphin cannot see what they delete.
const UNSEEN_TARGET_CATEGORIES: ReadonlySet<BypassRemovalCategory> = new Set([
  'variable-target',
  'command-substitution'
])

function categoryCopy(category: BypassRemovalCategory): { label: string; description: string } {
  switch (category) {
    case 'working-directory':
      return {
        label: translate(
          'auto.components.ComposerAgentPermissionPolicyField.workingDirectory',
          'Workspace folder'
        ),
        description: translate(
          'auto.components.ComposerAgentPermissionPolicyField.workingDirectoryDescription',
          'Delete the workspace folder'
        )
      }
    case 'variable-target':
      return {
        label: translate(
          'auto.components.ComposerAgentPermissionPolicyField.variableTarget',
          'Path from a variable'
        ),
        description: translate(
          'auto.components.ComposerAgentPermissionPolicyField.variableTargetDescription',
          'Delete a path built from a variable ($FOLDER)'
        )
      }
    case 'command-substitution':
      return {
        label: translate(
          'auto.components.ComposerAgentPermissionPolicyField.commandSubstitution',
          'Command result'
        ),
        description: translate(
          'auto.components.ComposerAgentPermissionPolicyField.commandSubstitutionDescription',
          'Delete the result of a $(…) command'
        )
      }
    case 'mounted-drive':
      return {
        label: translate(
          'auto.components.ComposerAgentPermissionPolicyField.mountedDrive',
          'Mounted drive'
        ),
        description: translate(
          'auto.components.ComposerAgentPermissionPolicyField.mountedDriveDescription',
          'Delete a mounted drive (/Volumes/… on a Mac)'
        )
      }
  }
}

function CategoryList({
  selected,
  onSelectedChange
}: {
  selected: readonly BypassRemovalCategory[]
  onSelectedChange: (next: BypassRemovalCategory[]) => void
}): React.JSX.Element {
  const idPrefix = useId()
  const selectedSet = new Set(selected)
  // Why rebuild from the catalog: keeps the persisted order stable regardless of click order.
  const setCategory = (category: BypassRemovalCategory, checked: boolean): void => {
    onSelectedChange(
      BYPASS_REMOVAL_CATEGORIES.filter((entry) =>
        entry === category ? checked : selectedSet.has(entry)
      )
    )
  }
  return (
    <div className="rounded-md border border-border/70 bg-muted/35 text-xs">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-1">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onSelectedChange([...MOST_USED_BYPASS_REMOVAL_CATEGORIES])}
          >
            {translate('auto.components.ComposerAgentPermissionPolicyField.mostUsed', 'Most used')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onSelectedChange([...BYPASS_REMOVAL_CATEGORIES])}
          >
            {translate('auto.components.ComposerAgentPermissionPolicyField.all', 'All')}
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => onSelectedChange([])}>
            {translate('auto.components.ComposerAgentPermissionPolicyField.none', 'None (clear)')}
          </Button>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {translate(
            'auto.components.ComposerAgentPermissionPolicyField.selectedCount',
            '{{value0}} of {{value1}} selected',
            { value0: selected.length, value1: BYPASS_REMOVAL_CATEGORIES.length }
          )}
        </span>
      </div>
      <ul className="px-3">
        {BYPASS_REMOVAL_CATEGORIES.map((category) => {
          const checkboxId = `${idPrefix}-${category}`
          const copy = categoryCopy(category)
          return (
            <li
              key={category}
              className="grid min-h-11 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2.5 border-b border-border/50 py-1.5 last:border-0"
            >
              <Checkbox
                id={checkboxId}
                checked={selectedSet.has(category)}
                onCheckedChange={(checked) => setCategory(category, checked === true)}
              />
              <Label htmlFor={checkboxId} className="block min-w-0 cursor-pointer">
                <span className="block font-medium text-foreground">{copy.label}</span>
                <span className="block text-muted-foreground">{copy.description}</span>
                {UNSEEN_TARGET_CATEGORIES.has(category) ? (
                  <span className="block text-destructive">
                    {translate(
                      'auto.components.ComposerAgentPermissionPolicyField.unseenTargetCaution',
                      "Dolphin can't see the target: this can delete any folder"
                    )}
                  </span>
                ) : null}
              </Label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AgentPermissionPolicyPicker({
  value,
  onValueChange
}: {
  /** Null is "always ask": Dolphin answers no prompt, as before this setting existed. */
  value: AgentPermissionPolicy | null
  onValueChange: (next: AgentPermissionPolicy | null) => void
}): React.JSX.Element {
  const triggerId = useId()
  const choice = toChoice(value)
  return (
    <div className="min-w-0 space-y-1.5" data-agent-permission-policy-picker={choice}>
      <label htmlFor={triggerId} className="text-xs font-medium text-muted-foreground">
        {translate(
          'auto.components.ComposerAgentPermissionPolicyField.label',
          'Deletion prompts in bypass mode'
        )}
      </label>
      <Select
        value={choice}
        onValueChange={(next) => {
          if (isPolicyChoice(next)) {
            onValueChange(toPolicy(next))
          }
        }}
      >
        <SelectTrigger id={triggerId} className="h-9 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ask">
            {translate('auto.components.ComposerAgentPermissionPolicyField.ask', 'Always ask')}
          </SelectItem>
          <SelectItem value="catalog">
            {translate(
              'auto.components.ComposerAgentPermissionPolicyField.catalog',
              'Configurable list'
            )}
          </SelectItem>
          <SelectItem value="approve-all">
            {translate(
              'auto.components.ComposerAgentPermissionPolicyField.approveAll',
              'Approve everything'
            )}
          </SelectItem>
        </SelectContent>
      </Select>
      {choice === 'ask' ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.ComposerAgentPermissionPolicyField.askDescription',
            'Claude asks you before every risky deletion. Dolphin approves nothing on its own.'
          )}
        </p>
      ) : null}
      {value?.mode === 'catalog' ? (
        <>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.ComposerAgentPermissionPolicyField.catalogDescription',
              'Dolphin approves only the kinds of deletion you check. Anything else still asks you.'
            )}
          </p>
          <CategoryList
            selected={value.categories}
            onSelectedChange={(categories) => onValueChange({ mode: 'catalog', categories })}
          />
        </>
      ) : null}
      {choice === 'approve-all' ? (
        <p className="text-xs text-destructive">
          {translate(
            'auto.components.ComposerAgentPermissionPolicyField.approveAllWarning',
            'Dolphin approves every deletion Claude asks about in bypass mode, including deleting this workspace folder. Nothing asks you first.'
          )}
        </p>
      ) : null}
    </div>
  )
}

export function ComposerAgentPermissionPolicyField({
  agent,
  executionHostId,
  value,
  onValueChange
}: {
  agent: TuiAgent | null
  executionHostId: string | null | undefined
  value: AgentPermissionPolicy | null
  onValueChange: (next: AgentPermissionPolicy | null) => void
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  if (!isAgentPermissionPolicyAvailable({ agent, executionHostId, settings })) {
    return null
  }
  return <AgentPermissionPolicyPicker value={value} onValueChange={onValueChange} />
}
