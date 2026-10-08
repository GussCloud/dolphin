import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FEATURE_TIPS, type FeatureTip } from '../../../../shared/feature-tips'
import { TelegramTipDialog } from './TelegramTipDialog'

vi.mock('./TelegramFeatureTipVisual', () => ({
  TelegramFeatureTipVisual: () => <div data-testid="telegram-visual" />
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
  const tip = FEATURE_TIPS.find((entry) => entry.id === 'telegram-integration')
  if (!tip) {
    throw new Error('Expected telegram-integration feature tip fixture')
  }
  return tip
}

describe('TelegramTipDialog', () => {
  it('announces the Telegram integration with its highlights and a setup action', () => {
    const html = renderToStaticMarkup(
      <TelegramTipDialog
        open
        tip={getTip()}
        primaryBusy={false}
        onOpenChange={() => {}}
        onPrimaryAction={() => {}}
        onSkip={() => {}}
      />
    )

    expect(html).toContain('NEW')
    expect(html).toContain('Telegram integration')
    expect(html).toContain('across all worktrees (SSH included)')
    expect(html).toContain('right from the buttons')
    expect(html).toContain('chat with Claude Code sessions through a channel (experimental, off by default)')
    expect(html).toContain('Set up Telegram')
    expect(html).toContain('Maybe Later')
    expect(html).toContain('telegram-visual')
  })
})
