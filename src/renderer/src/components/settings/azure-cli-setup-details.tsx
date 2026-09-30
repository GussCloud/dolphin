import { useState } from 'react'
import { ExternalLink, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { OnboardingInlineCommandTerminal } from '@/components/onboarding/OnboardingInlineCommandTerminal'
import {
  configureAzureDevOpsCliDefaults,
  refreshAzureCliSession
} from '@/lib/azure-devops-host-client'
import {
  AZURE_DEVOPS_CLI_EXTENSION_NAME,
  type AzureCliStatus,
  type AzureDevOpsAuthStatus
} from '../../../../shared/azure-devops-auth'
import { ProviderAccountScopeDetails } from './cli-source-control-integration-cards'
import { deriveAzureCliCardState } from './azure-cli-card-state'
import { AzureCliAutoRenewControl } from './azure-cli-auto-renew-control'

const INSTALL_URL = 'https://learn.microsoft.com/en-us/cli/azure/install-azure-cli'
const SIGN_IN_COMMAND = 'az login'
const EXTENSION_COMMAND = `az extension add --name ${AZURE_DEVOPS_CLI_EXTENSION_NAME}`

type SetupCommand = typeof SIGN_IN_COMMAND | typeof EXTENSION_COMMAND

function DefaultsForm(props: { azureCli: AzureCliStatus; onSaved: () => void }): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [organization, setOrganization] = useState(props.azureCli.defaultOrganization ?? '')
  const [project, setProject] = useState(props.azureCli.defaultProject ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty =
    organization.trim() !== (props.azureCli.defaultOrganization ?? '') ||
    project.trim() !== (props.azureCli.defaultProject ?? '')

  const save = (): void => {
    setSaving(true)
    setError(null)
    void configureAzureDevOpsCliDefaults(settings, {
      organization: organization.trim(),
      project: project.trim() || null
    })
      .then((result) => (result.ok ? props.onSaved() : setError(result.error)))
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : String(caught))
      )
      .finally(() => setSaving(false))
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.azureCliSetupDetails.defaultsHelp',
          'Default organization and project for Azure CLI commands (az devops configure).'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 min-w-[12rem] flex-1"
          value={organization}
          placeholder={translate(
            'auto.components.settings.azureCliSetupDetails.organizationPlaceholder',
            'https://dev.azure.com/contoso'
          )}
          aria-label={translate(
            'auto.components.settings.azureCliSetupDetails.organizationLabel',
            'Organization'
          )}
          onChange={(event) => setOrganization(event.target.value)}
        />
        <Input
          className="h-8 min-w-[8rem] flex-1"
          value={project}
          placeholder={translate(
            'auto.components.settings.azureCliSetupDetails.projectPlaceholder',
            'Project (optional)'
          )}
          aria-label={translate(
            'auto.components.settings.azureCliSetupDetails.projectLabel',
            'Project'
          )}
          onChange={(event) => setProject(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={saving || !dirty || !organization.trim()}>
          {saving
            ? translate('auto.components.settings.azureCliSetupDetails.saving', 'Saving…')
            : translate('auto.components.settings.azureCliSetupDetails.save', 'Save')}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  )
}

function stateMessage(
  state: ReturnType<typeof deriveAzureCliCardState>,
  account: string | null
): string | null {
  switch (state) {
    case 'unavailable':
      return translate(
        'auto.components.settings.azureCliSetupDetails.unavailable',
        'Azure CLI status is not available on this host yet. Re-check after the host updates.'
      )
    case 'not-installed':
      return translate(
        'auto.components.settings.azureCliSetupDetails.notInstalled',
        'The Azure CLI (az) is not installed on this host. Install it, then re-check.'
      )
    case 'not-authenticated':
      return translate(
        'auto.components.settings.azureCliSetupDetails.notAuthenticated',
        'Sign in with the Azure CLI. Dolphin uses that sign-in for Azure DevOps requests.'
      )
    case 'no-access':
      return translate(
        'auto.components.settings.azureCliSetupDetails.noAccess',
        'Signed in as {{value0}}, but Azure DevOps rejected the sign-in. Check the organization or sign in with another account.',
        { value0: account ?? '?' }
      )
    case 'connected':
      return account
        ? translate(
            'auto.components.settings.azureCliSetupDetails.signedInAs',
            'Signed in as {{value0}}.',
            { value0: account }
          )
        : null
    case 'checking':
      return null
  }
}

export function AzureCliSetupDetails(props: {
  status: AzureDevOpsAuthStatus | undefined
  checking: boolean
  refresh: () => void
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  const [command, setCommand] = useState<SetupCommand | null>(null)
  const state = deriveAzureCliCardState(props.status, props.checking)
  const azureCli = props.status?.azureCli
  const signedIn = state === 'connected' || state === 'no-access'
  const autoRenew = props.status?.autoRenewCliSession
  // Why: an older remote host omits the field and has no auto-renew to toggle.
  const showAutoRenew = autoRenew !== undefined && (signedIn || state === 'not-authenticated')
  const message = stateMessage(state, props.status?.account ?? azureCli?.account ?? null)

  const afterCommand = (exitCode: number | null): void => {
    // The CLI's token cache changed outside Dolphin; drop ours before re-probing.
    void refreshAzureCliSession(settings)
      .catch(() => undefined)
      .finally(() => {
        props.refresh()
        if (exitCode === 0) {
          setCommand(null)
        }
      })
  }

  if (state === 'checking' && !command) {
    return null
  }
  return (
    <ProviderAccountScopeDetails>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {state === 'not-installed' ? (
          <Button variant="outline" size="sm" onClick={() => window.api.shell.openUrl(INSTALL_URL)}>
            <ExternalLink className="size-3.5 mr-1.5" />
            {translate(
              'auto.components.settings.azureCliSetupDetails.install',
              'Install Azure CLI'
            )}
          </Button>
        ) : null}
        {state === 'not-authenticated' || state === 'no-access' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={command !== null}
            onClick={() => setCommand(SIGN_IN_COMMAND)}
          >
            <Terminal className="size-3.5" />
            {state === 'no-access'
              ? translate(
                  'auto.components.settings.azureCliSetupDetails.signInAgain',
                  'Sign in again'
                )
              : translate('auto.components.settings.azureCliSetupDetails.signIn', 'Sign in')}
          </Button>
        ) : null}
        {signedIn && azureCli && !azureCli.devopsExtensionInstalled ? (
          <Button
            variant="outline"
            size="sm"
            disabled={command !== null}
            onClick={() => setCommand(EXTENSION_COMMAND)}
          >
            <Terminal className="size-3.5" />
            {translate(
              'auto.components.settings.azureCliSetupDetails.installExtension',
              'Install azure-devops extension'
            )}
          </Button>
        ) : null}
        {state !== 'connected' || !azureCli?.devopsExtensionInstalled ? (
          <Button variant="ghost" size="sm" onClick={props.refresh}>
            {translate('auto.components.settings.azureCliSetupDetails.recheck', 'Re-check')}
          </Button>
        ) : null}
      </div>
      {showAutoRenew ? (
        <AzureCliAutoRenewControl
          enabled={autoRenew}
          tokenExpiresAt={azureCli?.tokenExpiresAt}
          onChanged={props.refresh}
        />
      ) : null}
      {signedIn && azureCli?.devopsExtensionInstalled ? (
        <DefaultsForm
          // Why keyed: reset the fields when the host reports new saved defaults.
          key={`${azureCli.defaultOrganization ?? ''}|${azureCli.defaultProject ?? ''}`}
          azureCli={azureCli}
          onSaved={props.refresh}
        />
      ) : null}
      {command ? (
        <OnboardingInlineCommandTerminal
          worktreeId="azure-cli-setup-terminal"
          command={command}
          title={translate(
            'auto.components.settings.azureCliSetupDetails.terminalTitle',
            'Azure CLI setup'
          )}
          ariaLabel={translate(
            'auto.components.settings.azureCliSetupDetails.terminalAriaLabel',
            'Azure CLI setup command'
          )}
          description={
            command === SIGN_IN_COMMAND
              ? translate(
                  'auto.components.settings.azureCliSetupDetails.signInDescription',
                  'Press Enter to run az login. Finish the browser sign-in; Dolphin re-checks when the command ends.'
                )
              : translate(
                  'auto.components.settings.azureCliSetupDetails.extensionDescription',
                  'Press Enter to install the azure-devops extension. Dolphin re-checks when the command ends.'
                )
          }
          autoScrollIntoView
          onCommandFinished={afterCommand}
          onTerminalExit={() => setCommand(null)}
        />
      ) : null}
    </ProviderAccountScopeDetails>
  )
}
