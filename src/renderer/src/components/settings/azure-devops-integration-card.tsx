import { useState } from 'react'
import { ExternalLink, GitPullRequestArrow } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { setAzureDevOpsAuthMethod } from '@/lib/azure-devops-host-client'
import {
  isAzureDevOpsAuthMethod,
  type AzureDevOpsAuthMethod
} from '../../../../shared/azure-devops-auth'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'
import { tokenProviderStatusLabel, type TokenProviderStatus } from './token-source-control-status'
import { AzureCliSetupDetails } from './azure-cli-setup-details'

function AzureDevOpsTokenDetails(props: {
  status: TokenProviderStatus
  refresh: () => void
}): React.JSX.Element {
  const { status, refresh } = props
  return (
    <IntegrationCardDetails>
      <p className="text-xs text-muted-foreground">
        {status === 'unavailable' ? (
          translate(
            'auto.components.settings.token.source.control.integration.cards.f3f47dc7de',
            'Azure DevOps status is not available in this runtime yet.'
          )
        ) : status === 'not-configured' ? (
          <>
            {translate(
              'auto.components.settings.token.source.control.integration.cards.7bbc9c64f0',
              'Set'
            )}{' '}
            <span className="font-mono text-[11px]">
              {translate(
                'auto.components.settings.token.source.control.integration.cards.48842720d2',
                'DOLPHIN_AZURE_DEVOPS_TOKEN'
              )}
            </span>
            {translate(
              'auto.components.settings.token.source.control.integration.cards.087feb92f1',
              ', or set'
            )}{' '}
            <span className="font-mono text-[11px]">
              {translate(
                'auto.components.settings.token.source.control.integration.cards.fbfd237f5e',
                'DOLPHIN_AZURE_DEVOPS_ACCESS_TOKEN'
              )}
            </span>
            {translate(
              'auto.components.settings.token.source.control.integration.cards.b8a10b07c1',
              '. Set'
            )}{' '}
            <span className="font-mono text-[11px]">
              {translate(
                'auto.components.settings.token.source.control.integration.cards.186a6689df',
                'DOLPHIN_AZURE_DEVOPS_API_BASE_URL'
              )}
            </span>{' '}
            {translate(
              'auto.components.settings.token.source.control.integration.cards.7bd345e3f6',
              'only when Dolphin cannot derive the API base URL from the git remote.'
            )}
          </>
        ) : (
          translate(
            'auto.components.settings.token.source.control.integration.cards.40f678df73',
            'Azure DevOps credentials are configured but could not authenticate. Check the token, API base URL, and repository permissions, then restart Dolphin if environment variables changed.'
          )
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.api.shell.openUrl(
              status === 'not-configured'
                ? 'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'
                : 'https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests'
            )
          }
        >
          <ExternalLink className="size-3.5 mr-1.5" />
          {translate(
            'auto.components.settings.token.source.control.integration.cards.1a9475dace',
            'Learn more'
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={refresh}>
          {translate(
            'auto.components.settings.token.source.control.integration.cards.793a06e899',
            'Re-check'
          )}
        </Button>
      </div>
    </IntegrationCardDetails>
  )
}

function AuthMethodToggle(props: {
  value: AzureDevOpsAuthMethod
  disabled: boolean
  onChange: (method: AzureDevOpsAuthMethod) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={props.value}
      disabled={props.disabled}
      aria-label={translate(
        'auto.components.settings.azureDevOpsIntegrationCard.authMethodLabel',
        'Azure DevOps sign-in method'
      )}
      onValueChange={(value) => {
        if (isAzureDevOpsAuthMethod(value) && value !== props.value) {
          props.onChange(value)
        }
      }}
    >
      <ToggleGroupItem value="token">
        {translate(
          'auto.components.settings.azureDevOpsIntegrationCard.methodToken',
          'Token (PAT)'
        )}
      </ToggleGroupItem>
      <ToggleGroupItem value="azure-cli">
        {translate(
          'auto.components.settings.azureDevOpsIntegrationCard.methodAzureCli',
          'Azure CLI'
        )}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function AzureDevOpsIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('azureDevOps')
  const settings = useAppStore((s) => s.settings)
  const azureDevOps = useAppStore((s) => s.preflightStatus?.azureDevOps)
  const [pendingMethod, setPendingMethod] = useState<AzureDevOpsAuthMethod | null>(null)
  const method: AzureDevOpsAuthMethod = pendingMethod ?? azureDevOps?.authMethod ?? 'token'
  const status = unavailable ? 'unavailable' : statuses.azureDevOpsStatus
  const configured = status === 'configured'
  const checking = status === 'checking' || pendingMethod !== null

  const changeMethod = (next: AzureDevOpsAuthMethod): void => {
    setPendingMethod(next)
    void setAzureDevOpsAuthMethod(settings, next)
      .then(() => refresh())
      .catch((error: unknown) => {
        toast.error(
          translate(
            'auto.components.settings.azureDevOpsIntegrationCard.methodChangeFailed',
            'Could not change the Azure DevOps sign-in method: {{value0}}',
            { value0: error instanceof Error ? error.message : String(error) }
          )
        )
      })
      .finally(() => setPendingMethod(null))
  }

  const target = statuses.azureDevOpsAccount ?? statuses.azureDevOpsBaseUrl
  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Azure DevOps"
      description={
        configured
          ? target
            ? translate(
                'auto.components.settings.token.source.control.integration.cards.ea204f5e03',
                '{{value0}} · Pull requests and build statuses',
                {
                  value0: target
                }
              )
            : translate(
                'auto.components.settings.token.source.control.integration.cards.54636c65d4',
                'Pull requests and build statuses for detected Azure Repos'
              )
          : method === 'azure-cli'
            ? translate(
                'auto.components.settings.azureDevOpsIntegrationCard.azureCliDescription',
                'Pull requests, repositories and work items through your Azure CLI sign-in.'
              )
            : translate(
                'auto.components.settings.token.source.control.integration.cards.0eb50d5593',
                'Pull requests and build statuses via Azure DevOps REST API tokens.'
              )
      }
      checking={checking}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={tokenProviderStatusLabel({
        configured,
        hasAccount: Boolean(statuses.azureDevOpsAccount),
        status
      })}
      actions={
        <AuthMethodToggle
          value={method}
          disabled={pendingMethod !== null || unavailable}
          onChange={changeMethod}
        />
      }
    >
      {method === 'azure-cli' ? (
        <AzureCliSetupDetails status={azureDevOps} checking={checking} refresh={refresh} />
      ) : status !== 'checking' && !configured ? (
        <AzureDevOpsTokenDetails status={status} refresh={refresh} />
      ) : null}
    </IntegrationCardShell>
  )
}
