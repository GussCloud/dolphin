import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { AzureCliDeviceCodeDisplay } from '../../../../shared/azure-devops-auth'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

async function copyCodeAndOpen(deviceCode: AzureCliDeviceCodeDisplay): Promise<void> {
  try {
    await window.api.ui.writeClipboardText(deviceCode.userCode)
    toast.success(
      translate(
        'auto.components.azureDevOpsSignInNotice.deviceCodeCopied',
        'Code copied. Paste it on the sign-in page.'
      )
    )
  } catch {
    toast.error(
      translate(
        'auto.components.azureDevOpsSignInNotice.deviceCodeCopyFailed',
        'Could not copy the code. Type it on the sign-in page.'
      )
    )
  }
  // Why open even after a failed copy: the code stays on screen to be typed.
  await window.api?.shell?.openUrl(deviceCode.verificationUrl)
}

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
      <code
        className="select-all text-center font-mono text-lg tracking-widest"
        aria-label={translate('auto.components.azureDevOpsSignInNotice.deviceCodeLabel', 'Code')}
      >
        {deviceCode.userCode}
      </code>
      <Button type="button" size="sm" onClick={() => void copyCodeAndOpen(deviceCode)}>
        <Copy className="size-3.5" />
        {translate(
          'auto.components.azureDevOpsSignInNotice.deviceCodeCopyAndOpen',
          'Copy code and open'
        )}
      </Button>
      <p className="select-all break-all text-center text-xs text-muted-foreground">
        {deviceCode.verificationUrl}
      </p>
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
