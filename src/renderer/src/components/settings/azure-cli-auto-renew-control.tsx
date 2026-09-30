import { useState } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { setAzureCliAutoRenew } from '@/lib/azure-devops-host-client'

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

export function AzureCliAutoRenewControl(props: {
  enabled: boolean
  tokenExpiresAt: number | null | undefined
  onChanged: () => void
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [pending, setPending] = useState<boolean | null>(null)
  const checked = pending ?? props.enabled
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
            'Could not change Azure CLI auto-renew: {{value0}}',
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
          disabled={pending !== null}
          onCheckedChange={(value) => change(value === true)}
        />
        <span className="space-y-0.5">
          <span className="block text-foreground">
            {translate(
              'auto.components.settings.azureCliAutoRenewControl.label',
              'Renew automatically when it expires?'
            )}
          </span>
          <span className="block text-muted-foreground">
            {translate(
              'auto.components.settings.azureCliAutoRenewControl.help',
              'Dolphin runs az login in the background when the sign-in expires; confirm it in the browser window that opens.'
            )}
          </span>
        </span>
      </label>
    </div>
  )
}
