import type { JSX } from 'react'
import type { FeatureTip } from '../../../../shared/feature-tips'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { FeatureTipActions } from './FeatureTipActions'
import { FeatureTipDialogFrame, FeatureTipEyebrow } from './FeatureTipDialogFrame'
import { TelegramFeatureTipVisual } from './TelegramFeatureTipVisual'

export function TelegramTipDialog({
  open,
  tip,
  primaryBusy,
  onOpenChange,
  onPrimaryAction,
  onSkip
}: {
  open: boolean
  tip: FeatureTip
  primaryBusy: boolean
  onOpenChange: (open: boolean) => void
  onPrimaryAction: () => void
  onSkip: () => void
}): JSX.Element {
  const highlights = [
    translate(
      'featureTips.telegram.statusHighlight',
      'Get the status and questions of every agent session, across all worktrees (SSH included).'
    ),
    translate(
      'featureTips.telegram.buttonsHighlight',
      'Answer questions and permission requests right from the buttons.'
    ),
    translate(
      'featureTips.telegram.channelsHighlight',
      'Chat with Claude Code sessions through channels.'
    )
  ]

  return (
    <FeatureTipDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      onOpenAutoFocus={(event) => event.preventDefault()}
      visual={<TelegramFeatureTipVisual />}
    >
      <DialogHeader className="text-left">
        <div>
          <FeatureTipEyebrow label={translate('featureTips.telegram.eyebrow', tip.eyebrow)} />
          <DialogTitle size="hero">{translate('featureTips.telegram.title', tip.title)}</DialogTitle>
          <DialogDescription className="mt-3 max-w-2xl">
            <span className="block">
              {translate('featureTips.telegram.description', tip.description)}
            </span>
            <span className="mt-3 block space-y-1.5">
              {highlights.map((highlight) => (
                <span key={highlight} className="flex items-start gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{highlight}</span>
                </span>
              ))}
            </span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <DialogFooter className="mt-8">
        <FeatureTipActions
          currentTip={tip}
          primaryBusy={primaryBusy}
          onPrimaryAction={onPrimaryAction}
          onSkip={onSkip}
          label={translate('featureTips.telegram.cta', tip.ctaLabel)}
        />
      </DialogFooter>
    </FeatureTipDialogFrame>
  )
}
