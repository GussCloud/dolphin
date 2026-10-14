import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { GitPullRequest, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAzureDevOpsPullRequestsAvailable } from '@/hooks/useAzureDevOpsPullRequestsAvailable'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'

export default function WhatsNewModal(): JSX.Element {
  // Subscribe to locale changes before using translate().
  useTranslation()
  const isOpen = useAppStore((s) => s.activeModal === 'whats-new')
  const rawVersion = useAppStore((s) => s.modalData.version)
  const closeModal = useAppStore((s) => s.closeModal)
  const openAzurePrsPage = useAppStore((s) => s.openAzurePrsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const azureAvailable = useAzureDevOpsPullRequestsAvailable()
  const version = typeof rawVersion === 'string' ? rawVersion : ''

  const bullets = [
    translate(
      'whatsNew.azurePrs.bullet.grouping',
      'Open pull requests grouped by PBI, Bug or Task'
    ),
    translate(
      'whatsNew.azurePrs.bullet.situation',
      "Each PR's situation: conflict, rejected, policy, waiting on you, pending or approved"
    ),
    translate(
      'whatsNew.azurePrs.bullet.details',
      'Policies, comments, and reviewers with their votes'
    ),
    translate('whatsNew.azurePrs.bullet.refresh', 'Refreshes automatically every 30 seconds'),
    translate(
      'whatsNew.azurePrs.bullet.menu',
      'Appears in the sidebar once Azure DevOps is set up with az login or a PAT'
    )
  ]

  const handlePrimary = (): void => {
    closeModal()
    if (azureAvailable) {
      openAzurePrsPage()
      return
    }
    openSettingsTarget({ pane: 'integrations', repoId: null })
    openSettingsPage()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            <Sparkles
              className="mr-2 inline size-4 align-text-bottom text-primary"
              aria-hidden="true"
            />
            {translate('whatsNew.title', "What's new in {{version}}", { version })}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'whatsNew.description',
              'A new way to keep an eye on your Azure DevOps pull requests.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitPullRequest className="size-4 text-primary" aria-hidden="true" />
            {translate('whatsNew.azurePrs.title', 'Azure (PRs)')}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={closeModal}>
            {translate('whatsNew.dismiss', 'Got it')}
          </Button>
          <Button onClick={handlePrimary}>
            {azureAvailable
              ? translate('whatsNew.azurePrs.open', 'Open Azure (PRs)')
              : translate('whatsNew.azurePrs.configure', 'Set up Azure DevOps')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
