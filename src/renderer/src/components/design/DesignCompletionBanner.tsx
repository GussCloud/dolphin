import { useState } from 'react'
import { CircleCheckBig, Hammer, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { DESIGN_MESSAGE_MAX_CHARS, type DesignCompletion } from '../../../../shared/design-types'
import { designVersionLabel } from './design-canvas-history'
import { formatDesignTimestamp } from './design-format'

/** The agent's "it is implemented" report, waiting for the user to confirm it or ask for more. */
export function DesignCompletionBanner({
  completion,
  approvedVersion,
  onConfirm,
  onDecline
}: {
  completion: DesignCompletion
  /** The version the user approved; a report on another version is flagged. */
  approvedVersion: number | null
  onConfirm: () => Promise<void>
  /** Rejects when the host refused; the typed text is kept so the user can retry. */
  onDecline: (text: string) => Promise<void>
}): React.JSX.Element {
  const [pending, setPending] = useState<'confirm' | 'decline' | null>(null)
  const [declining, setDeclining] = useState(false)
  const [text, setText] = useState('')

  const settle = async (kind: 'confirm' | 'decline', run: () => Promise<void>): Promise<void> => {
    setPending(kind)
    try {
      await run()
      setDeclining(false)
      setText('')
    } catch {
      // Why: the caller already reported the failure.
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      data-design-completion=""
      className="flex shrink-0 items-start gap-3 rounded-xl border border-status-success-border bg-status-success-background px-3 py-2.5"
    >
      <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-status-success" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {translate(
              'auto.components.design.completion.title',
              'The agent finished the implementation'
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {[
              completion.canvasVersion === null
                ? null
                : designVersionLabel(completion.canvasVersion),
              formatDesignTimestamp(completion.at)
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {approvedVersion !== null &&
        completion.canvasVersion !== null &&
        completion.canvasVersion !== approvedVersion ? (
          <p data-design-completion-redrawn="" className="text-xs text-status-warning">
            {translate(
              'auto.components.design.completion.redrawn',
              'The agent redrew the canvas after your approval of version {{value0}}: review version {{value1}} before confirming.',
              { value0: approvedVersion, value1: completion.canvasVersion }
            )}
          </p>
        ) : null}
        <p className="scrollbar-sleek max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-foreground">
          {completion.summary}
        </p>
        {declining ? (
          <div className="space-y-2">
            <Textarea
              value={text}
              autoFocus
              maxLength={DESIGN_MESSAGE_MAX_CHARS}
              disabled={pending !== null}
              placeholder={translate(
                'auto.components.design.completion.declinePlaceholder',
                'What is still missing or needs to change?'
              )}
              onChange={(event) => setText(event.target.value)}
              className="min-h-16"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending !== null}
                onClick={() => {
                  setDeclining(false)
                  setText('')
                }}
              >
                {translate('auto.components.design.completion.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                data-design-completion-action="decline-send"
                disabled={pending !== null || text.trim().length === 0}
                onClick={() => void settle('decline', () => onDecline(text.trim()))}
              >
                {pending === 'decline' ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {translate('auto.components.design.completion.declineSend', 'Send to the agent')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              data-design-completion-action="confirm"
              disabled={pending !== null}
              onClick={() => void settle('confirm', onConfirm)}
            >
              {pending === 'confirm' ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {translate('auto.components.design.completion.confirm', 'Confirm as done')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-design-completion-action="decline"
              disabled={pending !== null}
              onClick={() => setDeclining(true)}
            >
              {translate('auto.components.design.completion.decline', 'Ask for changes')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** In progress with no completion yet: the agent is building the approved canvas. */
export function DesignImplementingNotice({
  approvedVersion
}: {
  approvedVersion: number | null
}): React.JSX.Element {
  return (
    <span
      data-design-implementing=""
      className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap text-primary"
    >
      <Hammer className="size-3" />
      {approvedVersion === null
        ? translate('auto.components.design.implementing.label', 'Being implemented by the agent')
        : translate(
            'auto.components.design.implementing.withVersion',
            'Being implemented by the agent · version {{value0}}',
            { value0: approvedVersion }
          )}
    </span>
  )
}
