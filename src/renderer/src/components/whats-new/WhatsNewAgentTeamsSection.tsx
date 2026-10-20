import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { writeAgentDashboardView } from '../dashboard-popout/agent-dashboard-view-storage'
import { WhatsNewAgentOrbitPreview } from './WhatsNewAgentOrbitPreview'

export function WhatsNewAgentTeamsSection({ animate }: { animate: boolean }): JSX.Element {
  const closeModal = useAppStore((s) => s.closeModal)
  const dashboardEnabled = useAppStore((s) => s.settings?.experimentalAgentDashboardPopout === true)

  const bullets = [
    translate(
      'whatsNew.agentTeams.bullet.leads',
      "One avatar per running task; its ring shows each teammate's state"
    ),
    translate(
      'whatsNew.agentTeams.bullet.orbit',
      "Select a lead to open its team in orbit, with each teammate's current task"
    ),
    translate(
      'whatsNew.agentTeams.bullet.lineage',
      'Claude Agent Teams teammates now nest under their lead, with their own names'
    ),
    translate(
      'whatsNew.agentTeams.bullet.focus',
      'Large teams split into two rings, and the team waiting on you opens first'
    )
  ]

  const handlePrimary = (): void => {
    const state = useAppStore.getState()
    closeModal()
    writeAgentDashboardView('graph')
    // Why: the dashboard is opt-in; this button is the user asking for it.
    if (!dashboardEnabled) {
      void state.updateSettings({ experimentalAgentDashboardPopout: true })
    }
    if (state.settings?.experimentalAgentDashboardMode === 'popout') {
      void window.api.dashboard.openPopout?.()
      return
    }
    state.setSidebarOpen(true)
    state.setAgentDashboardDrawerOpen(true)
  }

  return (
    <>
      <DialogDescription>
        {translate(
          'whatsNew.agentTeams.description',
          'The Agent Dashboard has a new team view: every lead with its teammates in orbit.'
        )}
      </DialogDescription>
      <WhatsNewAgentOrbitPreview animate={animate} />
      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <DialogFooter>
        <Button variant="ghost" onClick={closeModal}>
          {translate('whatsNew.dismiss', 'Got it')}
        </Button>
        <Button onClick={handlePrimary}>
          {dashboardEnabled
            ? translate('whatsNew.agentTeams.open', 'Open the team view')
            : translate('whatsNew.agentTeams.enable', 'Turn on the Agent Dashboard')}
        </Button>
      </DialogFooter>
    </>
  )
}
