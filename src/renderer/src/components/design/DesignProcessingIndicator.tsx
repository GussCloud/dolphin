import {
  AlertTriangle,
  BellRing,
  CheckCheck,
  Clock,
  HelpCircle,
  LoaderCircle,
  Power
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { DesignProcessingState } from './design-processing-state'

type Notice = {
  icon: React.JSX.Element
  title: string
  detail?: string
  tone: 'active' | 'muted' | 'warning' | 'quiet'
}

function processingNotice(state: DesignProcessingState, answering: boolean): Notice | null {
  switch (state) {
    case 'processing':
      return {
        tone: 'active',
        icon: <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin" />,
        title: answering
          ? translate(
              'auto.components.design.processing.answering',
              'The agent is processing your reply…'
            )
          : translate('auto.components.design.processing.working', 'The agent is working…')
      }
    case 'needs-permission':
      return {
        tone: 'warning',
        icon: <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />,
        title: translate(
          'auto.components.design.processing.permission',
          'The agent asked for permission in the terminal. Open the workspace to answer it.'
        )
      }
    case 'queued':
      return {
        tone: 'muted',
        icon: <Clock className="mt-0.5 size-3.5 shrink-0" />,
        title: translate(
          'auto.components.design.processing.queued',
          'Your input is queued. Dolphin notifies the agent as soon as it is free.'
        )
      }
    case 'notified':
      return {
        tone: 'muted',
        icon: <BellRing className="mt-0.5 size-3.5 shrink-0" />,
        title: translate(
          'auto.components.design.processing.notified',
          'The agent was notified and has not read your input yet.'
        )
      }
    case 'offline':
      return {
        tone: 'warning',
        icon: <Power className="mt-0.5 size-3.5 shrink-0" />,
        title: translate(
          'auto.components.design.processing.offline',
          "The agent's terminal is not connected"
        ),
        detail: translate(
          'auto.components.design.processing.offlineDetail',
          'Your input stays saved and is delivered when the agent is back.'
        )
      }
    case 'unknown':
      return {
        tone: 'muted',
        icon: <HelpCircle className="mt-0.5 size-3.5 shrink-0" />,
        title: translate(
          'auto.components.design.processing.unknown',
          'Dolphin cannot see what the agent is doing right now.'
        )
      }
    case 'replied':
      return {
        tone: 'quiet',
        icon: <CheckCheck className="mt-0.5 size-3.5 shrink-0" />,
        title: translate('auto.components.design.processing.replied', 'The agent replied')
      }
    // Why: the delivery banner already shows a blocked delivery with its resend action.
    case 'blocked':
    case 'idle':
      return null
  }
}

/** What the agent is doing with the user's input, from the host's live view of its pane. */
export function DesignProcessingIndicator({
  state,
  answering
}: {
  state: DesignProcessingState
  /** User input is awaiting the agent, so "working" means working on it. */
  answering: boolean
}): React.JSX.Element | null {
  const notice = processingNotice(state, answering)
  if (!notice) {
    return null
  }
  return (
    <div
      role="status"
      aria-live="polite"
      data-design-processing={state}
      className={cn(
        'flex items-start gap-2 text-xs',
        notice.tone === 'quiet' ? 'px-1' : 'rounded-lg border px-3 py-2',
        notice.tone === 'active' && 'border-border bg-accent text-accent-foreground',
        notice.tone === 'muted' && 'border-border bg-muted text-muted-foreground',
        notice.tone === 'warning' &&
          'border-status-warning-border bg-status-warning-background text-status-warning',
        notice.tone === 'quiet' && 'text-muted-foreground'
      )}
    >
      {notice.icon}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn(notice.tone !== 'quiet' && 'font-medium')}>{notice.title}</p>
        {notice.detail ? <p className="text-muted-foreground">{notice.detail}</p> : null}
      </div>
    </div>
  )
}

/** One-line inline marker under the thread or answer the agent is working on. */
export function DesignProcessingInline(): React.JSX.Element {
  return (
    <p
      role="status"
      data-design-processing-inline=""
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <LoaderCircle className="size-3 shrink-0 animate-spin" />
      {translate('auto.components.design.processing.inline', 'Processing…')}
    </p>
  )
}
