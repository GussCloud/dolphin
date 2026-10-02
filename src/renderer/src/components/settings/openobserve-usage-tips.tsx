import { Copy, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { IntegrationStatusPill } from '@/components/integration-status-pill'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  OPENOBSERVE_SKILL_INSTALL_COMMAND,
  OPENOBSERVE_SKILL_NAME
} from '../../../../shared/openobserve-cli'
import type { OpenObserveSkillState } from './openobserve-card-state'
import {
  useIntegrationCommandRowClass,
  useIntegrationSubordinateRowClass
} from './integration-card-presentation'
import {
  getOpenObserveCommandExamples,
  getOpenObserveUsageTips
} from './openobserve-usage-tips-content'

export function OpenObserveCommandRow(props: { command: string }): React.JSX.Element {
  const commandRowClass = useIntegrationCommandRowClass()
  const label = translate(
    'auto.components.settings.openObserveUsageTips.copyCommand',
    'Copy command'
  )

  const copy = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(props.command)
      toast.success(
        translate('auto.components.settings.openObserveUsageTips.copiedCommand', 'Copied command.')
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate(
              'auto.components.settings.openObserveUsageTips.copyFailed',
              'Failed to copy command.'
            )
      )
    }
  }

  return (
    <div className={commandRowClass}>
      <code className="scrollbar-sleek min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
        {props.command}
      </code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            aria-label={label}
            onClick={() => void copy()}
          >
            <Copy className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function SkillStatusPill(props: { state: OpenObserveSkillState }): React.JSX.Element | null {
  switch (props.state) {
    case 'installed':
      return (
        <IntegrationStatusPill tone="connected">
          {translate('auto.components.settings.openObserveUsageTips.skillInstalled', 'Installed')}
        </IntegrationStatusPill>
      )
    case 'outdated':
      return (
        <IntegrationStatusPill tone="attention">
          {translate(
            'auto.components.settings.openObserveUsageTips.skillOutdated',
            'Update available'
          )}
        </IntegrationStatusPill>
      )
    case 'not-installed':
      return (
        <IntegrationStatusPill tone="attention">
          {translate(
            'auto.components.settings.openObserveUsageTips.skillNotInstalled',
            'Not installed'
          )}
        </IntegrationStatusPill>
      )
    case 'unknown':
      return null
  }
}

function skillDescription(state: OpenObserveSkillState, agents: string[]): string {
  switch (state) {
    case 'installed':
      return translate(
        'auto.components.settings.openObserveUsageTips.skillInstalledDescription',
        'Agents already know how to use the CLI. Installed for: {{value0}}.',
        { value0: agents.join(', ') }
      )
    case 'outdated':
      return translate(
        'auto.components.settings.openObserveUsageTips.skillOutdatedDescription',
        'The installed skill is older than this CLI. Update it so agents use the current commands.'
      )
    case 'not-installed':
    case 'unknown':
      return translate(
        'auto.components.settings.openObserveUsageTips.skillDescription',
        'The skill teaches coding agents (Claude Code, Codex, Cursor and others) how to query OpenObserve safely. It comes with the CLI and is installed for every agent found on this host.'
      )
  }
}

function skillActionLabel(state: OpenObserveSkillState): string | null {
  switch (state) {
    case 'installed':
      return null
    case 'outdated':
      return translate('auto.components.settings.openObserveUsageTips.updateSkill', 'Update skill')
    case 'not-installed':
    case 'unknown':
      return translate(
        'auto.components.settings.openObserveUsageTips.installSkill',
        'Install skill'
      )
  }
}

export function OpenObserveUsageTips(props: {
  skillState: OpenObserveSkillState
  skillAgents: string[]
  commandRunning: boolean
  onRunCommand: (command: string) => void
}): React.JSX.Element {
  const subordinateRowClass = useIntegrationSubordinateRowClass('space-y-2')
  const skillAction = skillActionLabel(props.skillState)

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground">
        {translate('auto.components.settings.openObserveUsageTips.title', 'Usage and tips')}
      </p>
      <div className={subordinateRowClass}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-foreground">
            {translate('auto.components.settings.openObserveUsageTips.skillLabel', 'Agent skill:')}{' '}
            <span className="font-mono text-[11px]">{OPENOBSERVE_SKILL_NAME}</span>
          </p>
          <SkillStatusPill state={props.skillState} />
        </div>
        <p className="text-xs text-muted-foreground">
          {skillDescription(props.skillState, props.skillAgents)}
        </p>
        <OpenObserveCommandRow command={OPENOBSERVE_SKILL_INSTALL_COMMAND} />
        {skillAction ? (
          <Button
            variant="outline"
            size="sm"
            disabled={props.commandRunning}
            onClick={() => props.onRunCommand(OPENOBSERVE_SKILL_INSTALL_COMMAND)}
          >
            <Terminal className="size-3.5" />
            {skillAction}
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.openObserveUsageTips.examplesIntro',
            'Commands you or your agents can run in any terminal:'
          )}
        </p>
        {getOpenObserveCommandExamples().map((example) => (
          <div key={example.command} className="space-y-1">
            <p className="text-xs text-muted-foreground">{example.description}</p>
            <OpenObserveCommandRow command={example.command} />
          </div>
        ))}
      </div>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {getOpenObserveUsageTips().map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  )
}
