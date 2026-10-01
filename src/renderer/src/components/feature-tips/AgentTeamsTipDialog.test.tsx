import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FEATURE_TIPS, type FeatureTip } from '../../../../shared/feature-tips'
import { AgentTeamsTipDialog } from './AgentTeamsTipDialog'

vi.mock('./AgentTeamsFeatureTipVisual', () => ({
  AgentTeamsFeatureTipVisual: () => <div data-testid="agent-teams-visual" />
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>
}))

function getTip(): FeatureTip {
  const tip = FEATURE_TIPS.find((entry) => entry.id === 'claude-agent-teams-windows')
  if (!tip) {
    throw new Error('Expected claude-agent-teams-windows feature tip fixture')
  }
  return tip
}

describe('AgentTeamsTipDialog', () => {
  it('announces Agent Teams with its demo and a link to agent settings', () => {
    const html = renderToStaticMarkup(
      <AgentTeamsTipDialog
        open
        tip={getTip()}
        primaryBusy={false}
        onOpenChange={() => {}}
        onPrimaryAction={() => {}}
        onSkip={() => {}}
        onAgentSettingsClick={() => {}}
      />
    )

    expect(html).toContain('NEW')
    expect(html).toContain('Claude Agent Teams on Windows')
    expect(html).toContain('Pick Claude Agent Teams when you start an agent')
    expect(html).toContain('Settings → Agents')
    expect(html).toContain('Got it')
    expect(html).toContain('agent-teams-visual')
  })
})
