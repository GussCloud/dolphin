import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { WhatsNewAzurePrsSection } from './WhatsNewAzurePrsSection'
import { WhatsNewAgentTeamsSection } from './WhatsNewAgentTeamsSection'

export default function WhatsNewModal(): JSX.Element {
  // Subscribe to locale changes before using translate().
  useTranslation()
  const isOpen = useAppStore((s) => s.activeModal === 'whats-new')
  const rawVersion = useAppStore((s) => s.modalData.version)
  const releaseId = useAppStore((s) => s.modalData.releaseId)
  const closeModal = useAppStore((s) => s.closeModal)
  const version = typeof rawVersion === 'string' ? rawVersion : ''

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
        </DialogHeader>
        {releaseId === 'agent-teams-orbit' ? (
          <WhatsNewAgentTeamsSection animate={isOpen} />
        ) : (
          <WhatsNewAzurePrsSection />
        )}
      </DialogContent>
    </Dialog>
  )
}
