import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import logo from '../../../../../resources/logo-gradient.svg'
import type { AgentInteractionAvatarFrame } from '../../../../shared/agent-interaction-avatar-ipc'
import type { AgentInteractionCueView } from '../../../../shared/agent-interaction-cue-queue'
import { AGENT_INTERACTION_KIND_PRESENTATION } from './agent-interaction-kind-presentation'
import { playAgentInteractionSound } from './agent-interaction-avatar-sound'
import { useAgentInteractionAvatarImage } from './use-agent-interaction-avatar-image'

function applyFrame(
  frame: AgentInteractionAvatarFrame,
  setView: (view: AgentInteractionCueView | null) => void
): void {
  setView(frame.view)
  if (frame.view && frame.sound) {
    void playAgentInteractionSound(frame.sound.kind, frame.sound.volume)
  }
}

export function AgentInteractionAvatar(): React.JSX.Element | null {
  const [view, setView] = useState<AgentInteractionCueView | null>(null)
  const [avatarRevision, setAvatarRevision] = useState(0)
  const customImage = useAgentInteractionAvatarImage(avatarRevision)

  useEffect(
    () =>
      window.api.settings.onChanged((updates) => {
        if ('agentInteraction' in updates) {
          setAvatarRevision((revision) => revision + 1)
        }
      }),
    []
  )

  useEffect(() => {
    const api = window.api.agentInteractionAvatar
    // Why subscribe first: a push that lands between the two calls must not be lost.
    const off = api.onFrame((frame) => applyFrame(frame, setView))
    void api.getFrame().then((frame) => applyFrame(frame, setView))
    return off
  }, [])

  if (!view) {
    return null
  }
  const presentation = AGENT_INTERACTION_KIND_PRESENTATION[view.cue.kind]
  const label = [presentation.title(), view.cue.workspaceLabel].filter(Boolean).join(' · ')

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="group relative">
        {/* Why no text: the avatar is a glanceable cue; the ring color carries the status. */}
        <button
          type="button"
          data-tone={presentation.tone}
          className="agent-avatar-buzz block size-16 cursor-pointer overflow-hidden rounded-full border-[3px] border-border bg-popover shadow-floating outline-none data-[tone=attention]:border-status-warning data-[tone=failure]:border-destructive data-[tone=success]:border-status-success"
          onClick={() => window.api.agentInteractionAvatar.activate()}
          aria-label={label}
        >
          <img
            src={customImage ?? logo}
            alt=""
            data-custom={customImage ? 'true' : 'false'}
            className="size-full object-cover data-[custom=false]:object-contain data-[custom=false]:p-1.5"
          />
        </button>
        <button
          type="button"
          className="absolute -top-1 -right-1 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-muted-foreground opacity-0 shadow-floating transition-opacity group-hover:opacity-100 hover:text-foreground"
          onClick={() => window.api.agentInteractionAvatar.dismiss()}
          aria-label={translate('agentInteraction.avatar.dismiss', 'Dismiss')}
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
