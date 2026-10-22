import { useState } from 'react'
import { ImageUp, RotateCcw } from 'lucide-react'
import logo from '../../../../../resources/logo-gradient.svg'
import type { AgentInteractionAvatarSettings } from '../../../../shared/agent-interaction-settings'
import { useAgentInteractionAvatarImage } from '../agent-interaction-avatar/use-agent-interaction-avatar-image'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'

type AgentInteractionAvatarSectionProps = {
  avatar: AgentInteractionAvatarSettings
  disabled: boolean
  onUpdate: (avatar: AgentInteractionAvatarSettings) => Promise<void>
}

export function AgentInteractionAvatarSection({
  avatar,
  disabled,
  onUpdate
}: AgentInteractionAvatarSectionProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const [isPicking, setIsPicking] = useState(false)
  const customImage = useAgentInteractionAvatarImage(`${avatar.source}:${avatar.customImagePath}`)

  const chooseImage = async (): Promise<void> => {
    setIsPicking(true)
    try {
      const path = await window.api.shell.pickImage()
      if (path) {
        await onUpdate({ source: 'custom', customImagePath: path })
      }
    } finally {
      if (mountedRef.current) {
        setIsPicking(false)
      }
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={customImage ?? logo}
          alt=""
          className="size-12 shrink-0 rounded-lg border border-border object-cover"
        />
        <div className="min-w-0 space-y-0.5">
          <Label>{translate('agentInteraction.settings.avatar.title', 'Avatar')}</Label>
          <p className="text-xs text-muted-foreground">
            {avatar.source === 'custom' && !customImage
              ? translate(
                  'agentInteraction.settings.avatar.unreadable',
                  'The chosen image could not be read; the Dolphin logo is shown instead.'
                )
              : translate(
                  'agentInteraction.settings.avatar.description',
                  'The picture on the floating card. PNG, JPG, GIF, WebP or SVG up to 5 MB.'
                )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {avatar.source === 'custom' ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => void onUpdate({ ...avatar, source: 'default' })}
          >
            <RotateCcw className="size-3.5" />
            {translate('agentInteraction.settings.avatar.reset', 'Use Dolphin logo')}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isPicking}
          onClick={() => void chooseImage()}
        >
          <ImageUp className="size-3.5" />
          {translate('agentInteraction.settings.avatar.choose', 'Choose image')}
        </Button>
      </div>
    </div>
  )
}
