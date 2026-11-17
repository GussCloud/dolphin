import { ExternalLink } from 'lucide-react'
import type { AzureCliDeviceCodeDisplay } from '../../../../shared/azure-devops-auth'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

/** The device-code sign-in as az printed it, so the desktop works even when no push arrived. */
export function AzureDevOpsDeviceCodeDetails({
  deviceCode
}: {
  deviceCode: AzureCliDeviceCodeDisplay
}): React.JSX.Element {
  const validUntil = new Date(deviceCode.expiresAtMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        {translate(
          'auto.components.azureDevOpsSignInNotice.deviceCodeIntro',
          'Open this page on any device and enter the code to renew your Azure DevOps sign-in.'
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void window.api?.shell?.openUrl(deviceCode.verificationUrl)}
      >
        <ExternalLink className="size-3.5" />
        {deviceCode.verificationUrl}
      </Button>
      <code
        className="select-all text-center font-mono text-lg tracking-widest"
        aria-label={translate('auto.components.azureDevOpsSignInNotice.deviceCodeLabel', 'Code')}
      >
        {deviceCode.userCode}
      </code>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.azureDevOpsSignInNotice.deviceCodeValidUntil',
          'Valid until {{value0}}',
          { value0: validUntil }
        )}
      </p>
    </div>
  )
}
