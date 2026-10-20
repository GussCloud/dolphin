// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { i18n } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import WhatsNewModal from './WhatsNewModal'

vi.mock('@/hooks/useAzureDevOpsPullRequestsAvailable', () => ({
  useAzureDevOpsPullRequestsAvailable: () => false
}))

const initialAppState = useAppStore.getInitialState()

function openWhatsNew(releaseId: string, dashboardEnabled: boolean): void {
  useAppStore.setState({
    activeModal: 'whats-new',
    modalData: { releaseId, version: '0.2.12' },
    settings: { ...getDefaultSettings('/tmp'), experimentalAgentDashboardPopout: dashboardEnabled }
  })
}

describe('WhatsNewModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    localStorage.clear()
    Object.defineProperty(window, 'api', { value: { dashboard: {} }, configurable: true })
  })
  afterEach(() => {
    cleanup()
    useAppStore.setState(initialAppState, true)
  })

  it('shows the animated team preview for the agent team release', () => {
    openWhatsNew('agent-teams-orbit', true)
    render(<WhatsNewModal />)

    expect(screen.getByText("What's new in 0.2.12")).toBeInTheDocument()
    expect(screen.getByTestId('whats-new-orbit-preview')).toBeInTheDocument()
    expect(screen.queryByText('Azure (PRs)')).not.toBeInTheDocument()
  })

  it('turns the dashboard on and opens the team view from the primary button', () => {
    const updateSettings = vi.fn(async () => {})
    openWhatsNew('agent-teams-orbit', false)
    useAppStore.setState({ updateSettings })
    render(<WhatsNewModal />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Turn on the Agent Dashboard' }))
    })

    expect(updateSettings).toHaveBeenCalledWith({ experimentalAgentDashboardPopout: true })
    expect(localStorage.getItem('dolphin.agent-dashboard.view.v1')).toBe('graph')
    expect(useAppStore.getState().agentDashboardDrawerOpen).toBe(true)
    expect(useAppStore.getState().activeModal).toBe('none')
  })

  it('keeps showing the Azure announcement for its own release', () => {
    openWhatsNew('azure-prs', false)
    render(<WhatsNewModal />)

    expect(screen.getByText('Azure (PRs)')).toBeInTheDocument()
    expect(screen.queryByTestId('whats-new-orbit-preview')).not.toBeInTheDocument()
  })
})
