import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  AGENT_INTERACTION_KINDS,
  mergeAgentInteractionSettings,
  type AgentInteractionAvatarSettings,
  type AgentInteractionEventSettings,
  type AgentInteractionKind,
  type AgentInteractionSettings,
  type AgentInteractionSettingsPatch
} from '../../../../shared/agent-interaction-settings'
import { Label } from '../ui/label'
import { Separator } from '../ui/separator'
import { Slider } from '../ui/slider'
import { translate } from '@/i18n/i18n'
import { AgentInteractionAvatarSection } from './AgentInteractionAvatarSection'
import { AgentInteractionEventRow } from './AgentInteractionEventRow'
import { NotificationSettingToggle } from './NotificationSettingToggle'

export { getAgentInteractionPaneSearchEntries } from './agent-interaction-search'

type AgentInteractionPaneProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

export function AgentInteractionPane({
  settings,
  updateSettings
}: AgentInteractionPaneProps): React.JSX.Element {
  const config = settings.agentInteraction
  // Why a ref: rapid toggles must merge into the latest write, not the last render's props.
  const configRef = useRef(config)
  const [volumeDraft, setVolumeDraft] = useState(config.volume)

  useEffect(() => {
    configRef.current = config
    setVolumeDraft(config.volume)
  }, [config])

  const update = async (patch: AgentInteractionSettingsPatch): Promise<void> => {
    const next: AgentInteractionSettings = mergeAgentInteractionSettings(configRef.current, patch)
    configRef.current = next
    await updateSettings({ agentInteraction: next })
  }
  const updateEvent = (kind: AgentInteractionKind) => (patch: Partial<AgentInteractionEventSettings>) =>
    update({ events: { [kind]: patch } })
  const updateAvatar = (avatar: AgentInteractionAvatarSettings) => update({ avatar })
  const disabled = !config.enabled

  return (
    <div className="space-y-1">
      <NotificationSettingToggle
        label={translate('agentInteraction.settings.enable.title', 'Enable Agent Integration')}
        description={translate(
          'agentInteraction.settings.enable.description',
          'Show a floating avatar in the corner of the screen and play a sound when an agent needs you or finishes, even while Dolphin is minimized.'
        )}
        checked={config.enabled}
        onToggle={() => void update({ enabled: !config.enabled })}
      />

      <Separator />

      <AgentInteractionAvatarSection
        avatar={config.avatar}
        disabled={disabled}
        onUpdate={updateAvatar}
      />

      <div className="space-y-2 py-2">
        <div className="flex items-center gap-2">
          <Volume2 className="size-4" />
          <Label>{translate('agentInteraction.settings.volume', 'Volume')}</Label>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            value={[volumeDraft]}
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            onValueChange={([value]) => setVolumeDraft(value)}
            onValueCommit={([value]) => void update({ volume: value })}
            className="flex-1"
            aria-label={translate('agentInteraction.settings.volume', 'Volume')}
          />
          <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {volumeDraft}%
          </span>
        </div>
      </div>

      <Separator />

      {AGENT_INTERACTION_KINDS.map((kind) => (
        <AgentInteractionEventRow
          key={kind}
          kind={kind}
          event={config.events[kind]}
          disabled={disabled}
          volume={volumeDraft}
          onUpdate={updateEvent(kind)}
        />
      ))}
    </div>
  )
}
