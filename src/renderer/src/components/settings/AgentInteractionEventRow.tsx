import { useState } from 'react'
import { Play, Upload } from 'lucide-react'
import type {
  AgentInteractionEventSettings,
  AgentInteractionKind
} from '../../../../shared/agent-interaction-settings'
import { AGENT_INTERACTION_KIND_PRESENTATION } from '../agent-interaction-avatar/agent-interaction-kind-presentation'
import { playAgentInteractionSound } from '../agent-interaction-avatar/agent-interaction-avatar-sound'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { Switch } from '../ui/switch'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import { describeAgentInteractionEvent } from './agent-interaction-event-copy'

const CHOOSE_CUSTOM_SOUND = 'choose-custom-file'

type SoundSelectValue = AgentInteractionEventSettings['soundSource'] | typeof CHOOSE_CUSTOM_SOUND

function isSoundSelectValue(value: string): value is SoundSelectValue {
  return value === 'default' || value === 'custom' || value === 'none' || value === CHOOSE_CUSTOM_SOUND
}

type AgentInteractionEventRowProps = {
  kind: AgentInteractionKind
  event: AgentInteractionEventSettings
  disabled: boolean
  volume: number
  onUpdate: (patch: Partial<AgentInteractionEventSettings>) => Promise<void>
}

export function AgentInteractionEventRow({
  kind,
  event,
  disabled,
  volume,
  onUpdate
}: AgentInteractionEventRowProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const [isPicking, setIsPicking] = useState(false)
  const presentation = AGENT_INTERACTION_KIND_PRESENTATION[kind]
  const Icon = presentation.icon
  const label = presentation.title()

  const chooseCustomSound = async (): Promise<void> => {
    setIsPicking(true)
    try {
      const path = await window.api.shell.pickAudio()
      if (path) {
        await onUpdate({ soundSource: 'custom', customSoundPath: path })
        await playAgentInteractionSound(kind, volume)
      }
    } finally {
      if (mountedRef.current) {
        setIsPicking(false)
      }
    }
  }

  const handleSoundChange = async (value: SoundSelectValue): Promise<void> => {
    if (value === CHOOSE_CUSTOM_SOUND) {
      await chooseCustomSound()
      return
    }
    await onUpdate({ soundSource: value })
    if (value !== 'none') {
      await playAgentInteractionSound(kind, volume)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4" />
          <Label>{label}</Label>
        </div>
        <p className="text-xs text-muted-foreground">{describeAgentInteractionEvent(kind)}</p>
        {event.soundSource === 'custom' && event.customSoundPath ? (
          <p
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={event.customSoundPath}
          >
            {event.customSoundPath}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={event.soundSource}
          disabled={disabled || !event.enabled || isPicking}
          onValueChange={(value) => {
            if (isSoundSelectValue(value)) {
              void handleSoundChange(value)
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-[160px]"
            aria-label={translate('agentInteraction.settings.soundFor', 'Sound for {{event}}', {
              event: label
            })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="default">
              {translate('agentInteraction.settings.sound.default', 'Dolphin sound')}
            </SelectItem>
            {event.customSoundPath ? (
              <SelectItem value="custom">
                {translate('agentInteraction.settings.sound.custom', 'Custom file')}
              </SelectItem>
            ) : null}
            <SelectItem value="none">
              {translate('agentInteraction.settings.sound.none', 'No sound')}
            </SelectItem>
            <SelectSeparator />
            <SelectItem value={CHOOSE_CUSTOM_SOUND}>
              <Upload className="size-4" />
              {event.customSoundPath
                ? translate('agentInteraction.settings.sound.change', 'Change custom file')
                : translate('agentInteraction.settings.sound.choose', 'Choose custom file')}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled || !event.enabled || event.soundSource === 'none'}
          onClick={() => void playAgentInteractionSound(kind, volume)}
          aria-label={translate('agentInteraction.settings.preview', 'Play {{event}} sound', {
            event: label
          })}
        >
          <Play />
        </Button>
        <Switch
          checked={event.enabled}
          disabled={disabled}
          aria-label={label}
          onCheckedChange={(enabled) => void onUpdate({ enabled })}
        />
      </div>
    </div>
  )
}
