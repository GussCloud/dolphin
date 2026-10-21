import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import logo from '../../../../../resources/logo-gradient.svg'
import type { AgentInteractionAvatarFrame } from '../../../../shared/agent-interaction-avatar-ipc'
import type { AgentInteractionCueView } from '../../../../shared/agent-interaction-cue-queue'
import { AGENT_INTERACTION_KIND_PRESENTATION } from './agent-interaction-kind-presentation'
import { playAgentInteractionSound } from './agent-interaction-avatar-sound'

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
  const { cue, pendingCount } = view
  const presentation = AGENT_INTERACTION_KIND_PRESENTATION[cue.kind]
  const Icon = presentation.icon
  const subtitle = [cue.workspaceLabel, cue.agentType].filter(Boolean).join(' · ')

  return (
    <div className="flex h-full w-full items-end justify-end p-4">
      <div
        role="alert"
        className="group relative flex w-full items-center gap-3 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-floating"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none"
          onClick={() => window.api.agentInteractionAvatar.activate()}
          aria-label={translate('agentInteraction.avatar.open', 'Open agent')}
        >
          <span className="relative shrink-0">
            <img src={logo} alt="" className="size-12 rounded-full" />
            <span
              data-tone={presentation.tone}
              className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground data-[tone=attention]:text-status-warning data-[tone=failure]:text-destructive data-[tone=success]:text-status-success"
            >
              <Icon className="size-3.5" />
            </span>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{presentation.title()}</span>
            {subtitle ? (
              <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
            ) : null}
          </span>
        </button>
        {pendingCount > 0 ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {translate('agentInteraction.avatar.pending', '+{{count}}', { count: pendingCount })}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          onClick={() => window.api.agentInteractionAvatar.dismiss()}
          aria-label={translate('agentInteraction.avatar.dismiss', 'Dismiss')}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
