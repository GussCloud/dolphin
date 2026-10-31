import { useState } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { setAzureCliAutoRenew } from '@/lib/azure-devops-host-client'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'

const VALIDITY_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'short'
})

export function azureCliTokenValidityMessage(
  tokenExpiresAt: number | null | undefined,
  nowMs: number
): string | null {
  if (!tokenExpiresAt) {
    return null
  }
  const at = VALIDITY_FORMAT.format(tokenExpiresAt)
  return tokenExpiresAt > nowMs
    ? translate(
        'auto.components.settings.azureCliAutoRenewControl.validUntil',
        'Token valid until {{value0}}.',
        { value0: at }
      )
    : translate(
        'auto.components.settings.azureCliAutoRenewControl.expiredAt',
        'Token expired at {{value0}}.',
        { value0: at }
      )
}

function noticeHelp(available: boolean, remote: boolean): string {
  if (remote) {
    return translate(
      'auto.components.settings.azureCliAutoRenewControl.remoteHelp',
      "The sign-in notice only works for the Azure CLI on this computer; on a remote server, run az login in that server's terminal."
    )
  }
  return available
    ? translate(
        'auto.components.settings.azureCliAutoRenewControl.help',
        'Dolphin shows the Azure DevOps icon and never opens the browser on its own. Click the icon to sign in.'
      )
    : translate(
        'auto.components.settings.azureCliAutoRenewControl.unavailableHelp',
        'Not available on this host: it has no display to show the sign-in. Run az login on the host when the sign-in expires.'
      )
}

export function AzureCliAutoRenewControl(props: {
  enabled: boolean
  // False when the host has no display for the sign-in, so the notice never shows.
  available: boolean
  tokenExpiresAt: number | null | undefined
  onChanged: () => void
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [pending, setPending] = useState<boolean | null>(null)
  // Why: the notice is desktop-local; a remote host's az login cannot finish in this window.
  const remote = getActiveRuntimeTarget(settings).kind === 'environment'
  const usable = props.available && !remote
  const checked = usable && (pending ?? props.enabled)
  // Why lazy state: render must stay pure; a stale clock only delays the "expired" wording.
  const [nowMs] = useState(Date.now)
  const validity = azureCliTokenValidityMessage(props.tokenExpiresAt, nowMs)

  const change = (next: boolean): void => {
    setPending(next)
    void setAzureCliAutoRenew(settings, next)
      .then(() => props.onChanged())
      .catch((error: unknown) => {
        toast.error(
          translate(
            'auto.components.settings.azureCliAutoRenewControl.changeFailed',
            'Could not change the Azure CLI sign-in notice: {{value0}}',
            { value0: error instanceof Error ? error.message : String(error) }
          )
        )
      })
      .finally(() => setPending(null))
  }

  return (
    <div className="space-y-1">
      {validity ? <p className="text-xs text-muted-foreground">{validity}</p> : null}
      <label className="flex items-start gap-2 text-xs">
        <Checkbox
          checked={checked}
          disabled={!usable || pending !== null}
          onCheckedChange={(value) => change(value === true)}
        />
        <span className="space-y-0.5">
          <span className="block text-foreground">
            {translate(
              'auto.components.settings.azureCliAutoRenewControl.label',
              'Show a visual notice when the sign-in expires'
            )}
          </span>
          <span className="block text-muted-foreground">{noticeHelp(props.available, remote)}</span>
        </span>
      </label>
    </div>
  )
}
