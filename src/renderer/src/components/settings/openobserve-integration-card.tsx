import { useState } from 'react'
import { ExternalLink, Telescope, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { OnboardingInlineCommandTerminal } from '@/components/onboarding/OnboardingInlineCommandTerminal'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { activateOpenObserveContext } from '@/lib/openobserve-host-client'
import {
  OPENOBSERVE_CLI_COMMAND,
  OPENOBSERVE_CLI_INSTALL_COMMAND,
  OPENOBSERVE_CLI_INSTALL_DOCS_URL,
  OPENOBSERVE_SERVICE_ACCOUNT_DOCS_URL,
  openObserveSignInCommand,
  type OpenObserveCliStatus
} from '../../../../shared/openobserve-cli'
import { ProviderAccountScopeDetails } from './cli-source-control-integration-cards'
import { IntegrationCardShell, type IntegrationCardStatusTone } from './integration-card-shell'
import {
  deriveOpenObserveCardState,
  deriveOpenObserveSkillState,
  type OpenObserveCardState
} from './openobserve-card-state'
import { OpenObserveContextForm } from './openobserve-context-form'
import { OpenObserveCommandRow, OpenObserveUsageTips } from './openobserve-usage-tips'
import { useOpenObserveCliStatus } from './use-openobserve-cli-status'

type InstalledStatus = Extract<OpenObserveCliStatus, { installed: true }>

function statusLabel(state: OpenObserveCardState): string {
  switch (state) {
    case 'connected':
      return translate(
        'auto.components.settings.openObserveIntegrationCard.statusConnected',
        'Connected'
      )
    case 'not-installed':
      return translate(
        'auto.components.settings.openObserveIntegrationCard.statusNotInstalled',
        'Not installed'
      )
    case 'not-configured':
      return translate(
        'auto.components.settings.openObserveIntegrationCard.statusNotConfigured',
        'Not configured'
      )
    case 'not-authenticated':
      return translate(
        'auto.components.settings.openObserveIntegrationCard.statusNotAuthenticated',
        'Not signed in'
      )
    case 'unavailable':
      return translate(
        'auto.components.settings.openObserveIntegrationCard.statusUnavailable',
        'Unavailable'
      )
    case 'checking':
      return ''
  }
}

function statusTone(state: OpenObserveCardState): IntegrationCardStatusTone {
  if (state === 'connected') {
    return 'connected'
  }
  return state === 'checking' || state === 'unavailable' ? 'neutral' : 'attention'
}

function terminalDescription(command: string): string {
  if (command === OPENOBSERVE_CLI_INSTALL_COMMAND) {
    return translate(
      'auto.components.settings.openObserveIntegrationCard.installDescription',
      'Press Enter to install openobserve-cli with npm (Node.js 18 or newer). Dolphin re-checks when the command ends.'
    )
  }
  if (
    command === openObserveSignInCommand('basic') ||
    command === openObserveSignInCommand('session')
  ) {
    return translate(
      'auto.components.settings.openObserveIntegrationCard.signInDescription',
      'Press Enter and answer the prompts here (or finish in the browser window). Your password or token goes straight to the CLI and your system keychain. Dolphin re-checks when the command ends.'
    )
  }
  return translate(
    'auto.components.settings.openObserveIntegrationCard.skillDescription',
    'Press Enter to install the openobserve skill for the coding agents on this host. Restart open agents afterwards so they load it.'
  )
}

function NotInstalledDetails(props: {
  commandRunning: boolean
  onRunCommand: (command: string) => void
  refresh: () => void
}): React.JSX.Element {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.openObserveIntegrationCard.notInstalled',
          'openobserve-cli is not installed on this host. Install it with npm (needs Node.js 18 or newer), or follow the installation guide for Go or a prebuilt binary. Then re-check.'
        )}
      </p>
      <OpenObserveCommandRow command={OPENOBSERVE_CLI_INSTALL_COMMAND} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={props.commandRunning}
          onClick={() => props.onRunCommand(OPENOBSERVE_CLI_INSTALL_COMMAND)}
        >
          <Terminal className="size-3.5" />
          {translate(
            'auto.components.settings.openObserveIntegrationCard.install',
            'Install with npm'
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.api.shell.openUrl(OPENOBSERVE_CLI_INSTALL_DOCS_URL)}
        >
          <ExternalLink className="size-3.5 mr-1.5" />
          {translate(
            'auto.components.settings.openObserveIntegrationCard.installGuide',
            'Installation guide'
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={props.refresh}>
          {translate('auto.components.settings.openObserveIntegrationCard.recheck', 'Re-check')}
        </Button>
      </div>
    </>
  )
}

function ContextSummary(props: {
  status: InstalledStatus
  onEdit: () => void
  refresh: () => void
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [switching, setSwitching] = useState(false)
  const { status } = props

  const switchContext = (name: string): void => {
    setSwitching(true)
    void activateOpenObserveContext(settings, name)
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error)
        }
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error))
      )
      .finally(() => {
        setSwitching(false)
        props.refresh()
      })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.openObserveIntegrationCard.contextSummary',
          'Profile {{value0}} · {{value1}} · organization {{value2}}',
          {
            value0: status.activeContext ?? '',
            value1: status.baseUrl ?? '',
            value2: status.org ?? ''
          }
        )}
      </p>
      {status.contexts.length > 1 ? (
        <Select
          value={status.activeContext ?? undefined}
          disabled={switching}
          onValueChange={switchContext}
        >
          <SelectTrigger
            size="sm"
            className="min-w-[8rem]"
            aria-label={translate(
              'auto.components.settings.openObserveIntegrationCard.switchContext',
              'Active profile'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {status.contexts.map((context) => (
              <SelectItem key={context.name} value={context.name}>
                {context.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Button variant="outline" size="sm" onClick={props.onEdit}>
        {translate('auto.components.settings.openObserveIntegrationCard.edit', 'Edit')}
      </Button>
    </div>
  )
}

function SignInDetails(props: {
  status: InstalledStatus
  state: OpenObserveCardState
  commandRunning: boolean
  onRunCommand: (command: string) => void
  refresh: () => void
}): React.JSX.Element {
  const { status } = props
  if (props.state === 'connected') {
    return (
      <p className="text-xs text-muted-foreground">
        {status.username
          ? translate(
              'auto.components.settings.openObserveIntegrationCard.signedInAs',
              'Signed in as {{value0}}. Agents on this host can query OpenObserve.',
              { value0: status.username }
            )
          : translate(
              'auto.components.settings.openObserveIntegrationCard.signedIn',
              'Signed in. Agents on this host can query OpenObserve.'
            )}
      </p>
    )
  }
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.openObserveIntegrationCard.notAuthenticated',
          'Sign in to finish the setup. The CLI checks your credentials against the server and keeps them in your system keychain.'
        )}
      </p>
      {status.authError ? (
        <p className="font-mono text-[11px] text-muted-foreground">{status.authError}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={props.commandRunning}
          onClick={() => props.onRunCommand(openObserveSignInCommand(status.authScheme))}
        >
          <Terminal className="size-3.5" />
          {translate('auto.components.settings.openObserveIntegrationCard.signIn', 'Sign in')}
        </Button>
        {status.authScheme === 'token' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.api.shell.openUrl(OPENOBSERVE_SERVICE_ACCOUNT_DOCS_URL)}
          >
            <ExternalLink className="size-3.5 mr-1.5" />
            {translate(
              'auto.components.settings.openObserveIntegrationCard.tokenGuide',
              'How to get a token'
            )}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={props.refresh}>
          {translate('auto.components.settings.openObserveIntegrationCard.recheck', 'Re-check')}
        </Button>
      </div>
    </>
  )
}

export function OpenObserveIntegrationCard(): React.JSX.Element {
  const { status, loading, loadError, refresh } = useOpenObserveCliStatus()
  const [command, setCommand] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const state = deriveOpenObserveCardState(status, loadError !== null)
  const installed = status?.installed ? status : null
  const showForm = installed !== null && (state === 'not-configured' || editing)

  const afterCommand = (exitCode: number | null): void => {
    refresh()
    if (exitCode === 0) {
      setCommand(null)
    }
  }

  return (
    <IntegrationCardShell
      icon={<Telescope className="size-5" />}
      name={translate('auto.components.settings.openObserveIntegrationCard.name', 'OpenObserve')}
      description={
        <>
          {translate(
            'auto.components.settings.openObserveIntegrationCard.summary',
            'Lets agents search logs, metrics and traces with the command-line tool'
          )}{' '}
          <span className="font-mono text-[11px]">{OPENOBSERVE_CLI_COMMAND}</span>
          {installed?.version ? (
            <span className="ml-1 text-muted-foreground/70">({installed.version})</span>
          ) : null}
        </>
      }
      statusLabel={statusLabel(state)}
      statusTone={statusTone(state)}
      checking={state === 'checking'}
      settingsSectionId="integrations-openobserve"
    >
      {state === 'checking' ? null : (
        <ProviderAccountScopeDetails>
          {state === 'unavailable' ? (
            <>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.openObserveIntegrationCard.unavailable',
                  'OpenObserve status is not available on this host yet. Re-check after the host updates.'
                )}
              </p>
              {loadError ? (
                <p className="font-mono text-[11px] text-muted-foreground">{loadError}</p>
              ) : null}
              <Button variant="ghost" size="sm" disabled={loading} onClick={refresh}>
                {translate(
                  'auto.components.settings.openObserveIntegrationCard.recheck',
                  'Re-check'
                )}
              </Button>
            </>
          ) : null}
          {state === 'not-installed' ? (
            <NotInstalledDetails
              commandRunning={command !== null}
              onRunCommand={setCommand}
              refresh={refresh}
            />
          ) : null}
          {installed && showForm ? (
            <OpenObserveContextForm
              // Why keyed: reset the fields when the host reports another active context.
              key={`${installed.activeContext ?? ''}|${installed.baseUrl ?? ''}|${installed.org ?? ''}`}
              defaults={{
                name: installed.activeContext,
                baseUrl: installed.baseUrl,
                org: installed.org,
                authScheme: installed.authScheme
              }}
              onSaved={() => {
                setEditing(false)
                refresh()
              }}
              onCancel={state === 'not-configured' ? undefined : () => setEditing(false)}
            />
          ) : null}
          {installed && !showForm && state !== 'not-configured' ? (
            <>
              <ContextSummary
                status={installed}
                onEdit={() => setEditing(true)}
                refresh={refresh}
              />
              <SignInDetails
                status={installed}
                state={state}
                commandRunning={command !== null}
                onRunCommand={setCommand}
                refresh={refresh}
              />
            </>
          ) : null}
          {installed ? (
            <OpenObserveUsageTips
              skillState={deriveOpenObserveSkillState(installed)}
              skillAgents={installed.skill?.installedAgents ?? []}
              commandRunning={command !== null}
              onRunCommand={setCommand}
            />
          ) : null}
          {command ? (
            <OnboardingInlineCommandTerminal
              worktreeId="openobserve-cli-setup-terminal"
              command={command}
              title={translate(
                'auto.components.settings.openObserveIntegrationCard.terminalTitle',
                'OpenObserve setup'
              )}
              ariaLabel={translate(
                'auto.components.settings.openObserveIntegrationCard.terminalAriaLabel',
                'OpenObserve setup command'
              )}
              description={terminalDescription(command)}
              autoScrollIntoView
              onCommandFinished={afterCommand}
              onTerminalExit={() => setCommand(null)}
            />
          ) : null}
        </ProviderAccountScopeDetails>
      )}
    </IntegrationCardShell>
  )
}
