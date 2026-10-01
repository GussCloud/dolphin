import type { JSX } from 'react'
import type { FeatureTip } from '../../../../shared/feature-tips'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { AgentTeamsFeatureTipVisual } from './AgentTeamsFeatureTipVisual'
import { FeatureTipActions } from './FeatureTipActions'
import {
  FeatureTipDialogFrame,
  FeatureTipEyebrow,
  FeatureTipSettingsLine
} from './FeatureTipDialogFrame'

export function AgentTeamsTipDialog({
  open,
  tip,
  primaryBusy,
  onOpenChange,
  onPrimaryAction,
  onSkip,
  onAgentSettingsClick
}: {
  open: boolean
  tip: FeatureTip
  primaryBusy: boolean
  onOpenChange: (open: boolean) => void
  onPrimaryAction: () => void
  onSkip: () => void
  onAgentSettingsClick: () => void
}): JSX.Element {
  return (
    <FeatureTipDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      // Why: keep the focus ring off the inline Settings link on open.
      onOpenAutoFocus={(event) => event.preventDefault()}
      visual={<AgentTeamsFeatureTipVisual />}
    >
      <DialogHeader className="text-left">
        <div>
          <FeatureTipEyebrow label={tip.eyebrow} />
          <DialogTitle size="hero">{tip.title}</DialogTitle>
          <DialogDescription className="mt-3 max-w-2xl">
            <span className="block space-y-3">
              <span className="block">{tip.description}</span>
              <span className="block">
                {translate(
                  'featureTips.agentTeams.launchInstruction',
                  'Pick Claude Agent Teams when you start an agent, then ask it to create a team.'
                )}
              </span>
              <FeatureTipSettingsLine
                lead={translate(
                  'featureTips.agentTeams.settingsInstruction',
                  'Change what every team is told in'
                )}
                link={translate('featureTips.agentTeams.settingsLink', 'Settings → Agents')}
                onClick={onAgentSettingsClick}
              />
            </span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <DialogFooter className="mt-8 flex sm:justify-stretch">
        <FeatureTipActions
          currentTip={tip}
          primaryBusy={primaryBusy}
          onPrimaryAction={onPrimaryAction}
          onSkip={onSkip}
          showSkip={false}
          fullWidth
        />
      </DialogFooter>
    </FeatureTipDialogFrame>
  )
}
