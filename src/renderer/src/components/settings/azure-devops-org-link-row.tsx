import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import { getAzureDevOpsOrgLink } from '@/lib/azure-devops-host-client'
import { useAppStore } from '@/store'
import type { AzureDevOpsOrgLinkStatus } from '../../../../shared/azure-devops-org-link'
import { useIntegrationSubordinateRowClass } from './integration-card-presentation'

function orgLinkMessage(link: AzureDevOpsOrgLinkStatus): string {
  switch (link.status) {
    case 'connected':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.connected',
        'Connected to organization {{value0}}',
        { value0: link.organizationName }
      )
    case 'not-registered':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.notRegistered',
        "Your Azure DevOps organization isn't registered in Dolphin"
      )
    case 'signed-out':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.signedOut',
        'Sign in to your Dolphin account to connect to your organization'
      )
    case 'azure-devops-not-authenticated':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.azureDevOpsNotAuthenticated',
        'Azure DevOps did not accept your sign-in, so your Dolphin organization could not be checked'
      )
    case 'no-organization':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.noOrganization',
        'Set a default Azure DevOps organization to connect to your Dolphin organization'
      )
    case 'unsupported-host':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.unsupportedHost',
        'Dolphin organizations support Azure DevOps Services (dev.azure.com) only'
      )
    case 'remote-host-unavailable':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.remoteHostUnavailable',
        'Dolphin organization status is unavailable for remote hosts'
      )
    case 'error':
      return translate(
        'auto.components.settings.azureDevOpsOrgLink.error',
        'Could not check your Dolphin organization: {{value0}}',
        { value0: link.reason }
      )
  }
}

/** One status line: which Dolphin organization this Azure DevOps sign-in links to. */
// Callers key it by the Azure DevOps organization so a change remounts and re-checks.
export function AzureDevOpsOrgLinkRow(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const rowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const mountedRef = useMountedRef()
  const [link, setLink] = useState<AzureDevOpsOrgLinkStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const latestRequestRef = useRef(0)
  const runtimeEnvironmentId = settings?.activeRuntimeEnvironmentId ?? null

  const check = useCallback(
    (force: boolean): void => {
      const request = ++latestRequestRef.current
      const isLatest = (): boolean => mountedRef.current && request === latestRequestRef.current
      setChecking(true)
      void getAzureDevOpsOrgLink({ activeRuntimeEnvironmentId: runtimeEnvironmentId }, { force })
        .catch((error: unknown): AzureDevOpsOrgLinkStatus => ({
          status: 'error',
          reason: error instanceof Error ? error.message : String(error)
        }))
        .then((result) => {
          if (isLatest()) {
            setLink(result)
          }
        })
        .finally(() => {
          if (isLatest()) {
            setChecking(false)
          }
        })
    },
    [mountedRef, runtimeEnvironmentId]
  )

  useEffect(() => {
    check(false)
  }, [check])

  const remote = link?.status === 'remote-host-unavailable'
  return (
    <div className={rowClass} data-testid="azure-devops-org-link">
      <Building2 className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {link
          ? orgLinkMessage(link)
          : translate(
              'auto.components.settings.azureDevOpsOrgLink.checking',
              'Checking your Dolphin organization…'
            )}
      </p>
      {link?.status === 'signed-out' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openSettingsTarget({ pane: 'dolphin-account', repoId: null })}
        >
          {translate(
            'auto.components.settings.azureDevOpsOrgLink.openAccount',
            'Open Dolphin account'
          )}
        </Button>
      ) : null}
      {remote ? null : (
        <Button variant="ghost" size="sm" disabled={checking} onClick={() => check(true)}>
          {checking ? <LoaderCircle className="size-3.5 mr-1.5 animate-spin" /> : null}
          {translate('auto.components.settings.azureDevOpsOrgLink.checkNow', 'Check now')}
        </Button>
      )}
    </div>
  )
}
