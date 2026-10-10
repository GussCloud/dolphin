import { useState } from 'react'
import { AlertCircle, CheckCircle2, Download, ExternalLink, Loader2 } from 'lucide-react'
import { PWSH_DOWNLOAD_URL, PWSH_WINGET_INSTALL_COMMAND } from '../../../../shared/pwsh-install'
import { translate } from '@/i18n/i18n'
import {
  cancelPwshInstall,
  isPwshInstallSupported,
  startPwshInstall,
  usePwshInstallPhase
} from '@/lib/pwsh-install-store'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'

type PowerShell7InstallPanelProps = {
  pwshAvailable: boolean
  capabilitiesLoading: boolean
  /** Onboarding renders above body-level dialogs, so its confirmation must stack higher. */
  aboveOnboarding?: boolean
}

function openDownloadPage(): void {
  void window.api.shell.openUrl(PWSH_DOWNLOAD_URL)
}

function DownloadPageButton(): React.JSX.Element {
  return (
    <Button type="button" variant="outline" size="sm" onClick={openDownloadPage}>
      <ExternalLink />
      {translate(
        'auto.components.settings.PowerShell7InstallPanel.openDownloadPage',
        'Open download page'
      )}
    </Button>
  )
}

function InstallConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  aboveOnboarding
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  aboveOnboarding: boolean
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={aboveOnboarding ? 'z-[130] max-w-md' : 'max-w-md'}
        overlayClassName={aboveOnboarding ? 'z-[120]' : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.confirmTitle',
              'Install PowerShell 7?'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.confirmDescription',
              "Dolphin will install PowerShell 7 on this computer using Microsoft's Windows Package Manager (winget) by running:"
            )}
          </DialogDescription>
        </DialogHeader>
        <code className="block rounded-md border border-border/70 bg-muted/35 px-3 py-2 font-mono text-xs break-all text-foreground">
          {PWSH_WINGET_INSTALL_COMMAND}
        </code>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.confirmUac',
              'Windows may ask for administrator permission (UAC) to finish the installation.'
            )}
          </li>
          <li>
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.confirmSize',
              'The download is about 110 MB and usually takes a few minutes.'
            )}
          </li>
          <li>
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.confirmAgreements',
              'This accepts the PowerShell package and winget source agreements on your behalf.'
            )}
          </li>
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {translate('auto.components.settings.PowerShell7InstallPanel.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {translate('auto.components.settings.PowerShell7InstallPanel.install', 'Install')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** PowerShell 7 recommendation and local install flow; renders nothing once pwsh is present. */
export function PowerShell7InstallPanel({
  pwshAvailable,
  capabilitiesLoading,
  aboveOnboarding = false
}: PowerShell7InstallPanelProps): React.JSX.Element | null {
  const phase = usePwshInstallPhase()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!isPwshInstallSupported()) {
    return null
  }

  if (phase.kind === 'installed') {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-status-success-border bg-status-success-background px-4 py-3"
        data-pwsh-install-state="installed"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-success" />
        <div className="min-w-0 space-y-1 text-[13px] leading-relaxed">
          <p className="font-medium text-foreground">
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.installedTitle',
              'PowerShell 7 is installed'
            )}
          </p>
          <p className="text-muted-foreground">
            {phase.pwshAvailable
              ? translate(
                  'auto.components.settings.PowerShell7InstallPanel.installedDescription',
                  'New PowerShell terminals will use PowerShell 7. Terminals that are already open keep their current shell.'
                )
              : translate(
                  'auto.components.settings.PowerShell7InstallPanel.installedUndetected',
                  'Dolphin could not detect it yet. Restart Dolphin to start using PowerShell 7 in new terminals.'
                )}
          </p>
        </div>
      </div>
    )
  }

  if (pwshAvailable || (capabilitiesLoading && phase.kind === 'idle')) {
    return null
  }

  if (phase.kind === 'installing') {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-pwsh-install-state="installing"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
          <div className="min-w-0 space-y-1 text-[13px] leading-relaxed">
            <p className="font-medium text-foreground">
              {translate(
                'auto.components.settings.PowerShell7InstallPanel.installingTitle',
                'Installing PowerShell 7…'
              )}
            </p>
            <p className="text-muted-foreground">
              {translate(
                'auto.components.settings.PowerShell7InstallPanel.installingDescription',
                'This can take a few minutes. If Windows asks for administrator permission, approve it to continue.'
              )}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={cancelPwshInstall}>
          {translate('auto.components.settings.PowerShell7InstallPanel.cancel', 'Cancel')}
        </Button>
      </div>
    )
  }

  if (phase.kind === 'winget-unavailable') {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-pwsh-install-state="winget-unavailable"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1 text-[13px] leading-relaxed">
            <p className="font-medium text-foreground">
              {translate(
                'auto.components.settings.PowerShell7InstallPanel.wingetUnavailableTitle',
                'Windows Package Manager is not available'
              )}
            </p>
            <p className="text-muted-foreground">
              {translate(
                'auto.components.settings.PowerShell7InstallPanel.wingetUnavailableDescription',
                'winget was not found on this computer. Download the PowerShell 7 installer from Microsoft instead.'
              )}
            </p>
          </div>
        </div>
        <DownloadPageButton />
      </div>
    )
  }

  if (phase.kind === 'failed' || phase.kind === 'timed-out') {
    return (
      <>
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3"
          data-pwsh-install-state={phase.kind}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 space-y-1 text-[13px] leading-relaxed">
              <p className="font-medium text-foreground">
                {translate(
                  'auto.components.settings.PowerShell7InstallPanel.failedTitle',
                  'PowerShell 7 was not installed'
                )}
              </p>
              <p className="break-words text-muted-foreground">
                {phase.kind === 'timed-out'
                  ? translate(
                      'auto.components.settings.PowerShell7InstallPanel.timedOutDescription',
                      'The installation took longer than 15 minutes and was stopped.'
                    )
                  : phase.message}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-6">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
              {translate('auto.components.settings.PowerShell7InstallPanel.retry', 'Try again')}
            </Button>
            <DownloadPageButton />
          </div>
        </div>
        <InstallConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          aboveOnboarding={aboveOnboarding}
          onConfirm={() => {
            setConfirmOpen(false)
            void startPwshInstall()
          }}
        />
      </>
    )
  }

  return (
    <>
      <div
        className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-pwsh-install-state="not-installed"
      >
        <div className="min-w-0 space-y-1 text-[13px] leading-relaxed">
          <p className="font-medium text-foreground">
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.recommendTitle',
              'PowerShell 7 is recommended'
            )}
          </p>
          <p className="text-muted-foreground">
            {translate(
              'auto.components.settings.PowerShell7InstallPanel.recommendDescription',
              'It uses less memory per terminal than Windows PowerShell 5.1 and runs the same commands. Once installed, Dolphin uses it automatically.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setConfirmOpen(true)}>
          <Download />
          {translate(
            'auto.components.settings.PowerShell7InstallPanel.installButton',
            'Install PowerShell 7'
          )}
        </Button>
      </div>
      <InstallConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        aboveOnboarding={aboveOnboarding}
        onConfirm={() => {
          setConfirmOpen(false)
          void startPwshInstall()
        }}
      />
    </>
  )
}
