import { useEffect, useState, type JSX, type ReactNode } from 'react'
import { Check, Send } from 'lucide-react'
import { usePrefersReducedMotion } from '@/components/feature-wall/feature-wall-modal-helpers'
import { translate } from '@/i18n/i18n'

export type TelegramDemoPhase = 'idle' | 'status' | 'question' | 'answered' | 'channel' | 'done'

const PHASE_ORDER: readonly TelegramDemoPhase[] = [
  'idle',
  'status',
  'question',
  'answered',
  'channel',
  'done'
]

const PHASE_MS: Record<TelegramDemoPhase, number> = {
  idle: 700,
  status: 1500,
  question: 1700,
  answered: 1400,
  channel: 1400,
  done: 3200
}

export function nextTelegramDemoPhase(phase: TelegramDemoPhase): TelegramDemoPhase {
  const next = PHASE_ORDER[PHASE_ORDER.indexOf(phase) + 1]
  return next ?? 'idle'
}

function reached(phase: TelegramDemoPhase, target: TelegramDemoPhase): boolean {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(target)
}

function ChatBubble({
  outgoing = false,
  meta,
  children
}: {
  outgoing?: boolean
  meta?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div
      data-outgoing={outgoing}
      className="flex animate-in fade-in-0 slide-in-from-bottom-1 data-[outgoing=true]:justify-end motion-reduce:animate-none"
    >
      <div
        data-outgoing={outgoing}
        className="max-w-[85%] rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-[11px] leading-snug text-foreground data-[outgoing=true]:border-primary/40 data-[outgoing=true]:bg-primary/10"
      >
        {meta ? <div className="mb-0.5 truncate text-[10px] text-muted-foreground">{meta}</div> : null}
        {children}
      </div>
    </div>
  )
}

function ReplyButton({ picked, children }: { picked: boolean; children: ReactNode }): JSX.Element {
  return (
    <span
      data-picked={picked}
      className="flex-1 rounded-md border border-border/80 bg-background px-2 py-1 text-center text-[10px] font-medium text-muted-foreground transition-colors data-[picked=true]:border-primary/60 data-[picked=true]:bg-primary/15 data-[picked=true]:text-foreground"
    >
      {children}
    </span>
  )
}

export function TelegramFeatureTipVisual(): JSX.Element {
  const reducedMotion = usePrefersReducedMotion()
  const [state, setState] = useState<TelegramDemoPhase>('idle')
  // Why: reduced motion freezes on the finished conversation instead of looping.
  const phase: TelegramDemoPhase = reducedMotion ? 'done' : state

  useEffect(() => {
    if (reducedMotion) {
      return
    }
    const timeoutId = window.setTimeout(
      () => setState((current) => nextTelegramDemoPhase(current)),
      PHASE_MS[state]
    )
    return () => window.clearTimeout(timeoutId)
  }, [reducedMotion, state])

  return (
    <div
      className="relative flex h-full min-h-[23rem] flex-col items-center justify-center overflow-hidden px-5 py-7"
      aria-hidden="true"
    >
      <div className="flex h-[21rem] w-full max-w-[22rem] flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-left shadow-xs">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Send className="size-3" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium text-foreground">
              {translate('featureTips.telegram.demoBotName', 'Dolphin bot')}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {translate('featureTips.telegram.demoBotStatus', 'bot')}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden bg-[var(--editor-surface)] p-2.5">
          {reached(phase, 'status') ? (
            <ChatBubble meta={translate('featureTips.telegram.demoStatusMeta', 'api-auth · SSH')}>
              <span className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3 shrink-0 text-status-success" />
                {translate('featureTips.telegram.demoStatusText', 'Claude Code finished the task')}
              </span>
            </ChatBubble>
          ) : null}
          {reached(phase, 'question') ? (
            <ChatBubble meta={translate('featureTips.telegram.demoQuestionMeta', 'web-ui · Codex')}>
              <span className="block">
                {translate('featureTips.telegram.demoQuestionText', 'Allow running pnpm test?')}
              </span>
              <span className="mt-1.5 flex gap-1.5">
                <ReplyButton picked={reached(phase, 'answered')}>
                  {translate('featureTips.telegram.demoAllow', 'Allow')}
                </ReplyButton>
                <ReplyButton picked={false}>
                  {translate('featureTips.telegram.demoDeny', 'Deny')}
                </ReplyButton>
              </span>
            </ChatBubble>
          ) : null}
          {reached(phase, 'channel') ? (
            <ChatBubble outgoing>
              {translate('featureTips.telegram.demoChannelPrompt', 'Also update the changelog')}
            </ChatBubble>
          ) : null}
          {phase === 'done' ? (
            <ChatBubble meta={translate('featureTips.telegram.demoChannelMeta', 'Claude Code')}>
              {translate('featureTips.telegram.demoChannelReply', 'On it: updating CHANGELOG.md')}
            </ChatBubble>
          ) : null}
        </div>
      </div>
    </div>
  )
}
