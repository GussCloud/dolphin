import { useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NativeChatQuestionOptionRow } from '@/components/native-chat/NativeChatQuestionCard'
import { translate } from '@/i18n/i18n'
import {
  DESIGN_MESSAGE_MAX_CHARS,
  isDesignDecisionOpen,
  type DesignDecision
} from '../../../../shared/design-types'
import { formatDesignTimestamp } from './design-format'
import { DesignProcessingInline } from './DesignProcessingIndicator'

function toggleSelection(selected: number[], index: number, multiSelect: boolean): number[] {
  if (multiSelect) {
    return selected.includes(index)
      ? selected.filter((entry) => entry !== index)
      : [...selected, index].toSorted((a, b) => a - b)
  }
  return selected.includes(index) ? [] : [index]
}

/** An agent question on the design: the native-chat pick-list look, plus a note and an explicit answer. */
export function DesignDecisionCard({
  decision,
  blockTitle,
  onAnswer,
  onHoverChange,
  processing = false
}: {
  decision: DesignDecision
  /** Title of the block the question is about, when it is about one. */
  blockTitle: string | null
  onAnswer: (input: { decisionId: string; selected: string[]; note?: string }) => Promise<void>
  onHoverChange: (blockId: string | null) => void
  /** The agent is working on this answer. */
  processing?: boolean
}): React.JSX.Element {
  const [selected, setSelected] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const open = isDesignDecisionOpen(decision)
  // Why the note alone counts: none of the agent's options may fit, and the user writes their own.
  const canAnswer = selected.length > 0 || note.trim().length > 0
  const revision = open ? undefined : decision.revision

  const submit = async (): Promise<void> => {
    const labels = selected.flatMap((index) => {
      const label = decision.options[index]?.label
      return label ? [label] : []
    })
    const trimmed = note.trim()
    if (labels.length === 0 && !trimmed) {
      return
    }
    setSubmitting(true)
    try {
      await onAnswer({
        decisionId: decision.id,
        selected: labels,
        ...(trimmed ? { note: trimmed } : {})
      })
      // Why: the card re-renders as answered under the pointer, so mouseleave never fires.
      onHoverChange(null)
    } catch {
      // Why: the caller already reported the failure; the picks stay so the user can retry.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      data-design-decision={decision.id}
      className="overflow-hidden rounded-lg border border-input bg-card shadow-xs"
      onMouseEnter={() => onHoverChange(decision.blockId ?? null)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <div className="space-y-1.5 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {decision.header ? (
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {decision.header}
            </span>
          ) : null}
          {blockTitle ? (
            <span className="truncate text-[11px] text-muted-foreground">
              {translate('auto.components.design.decision.aboutBlock', 'About: {{value0}}', {
                value0: blockTitle
              })}
            </span>
          ) : null}
        </div>
        <p className="break-words text-sm font-semibold text-foreground">{decision.question}</p>
        {decision.multiSelect && open ? (
          <p className="text-[11px] text-muted-foreground">
            {translate('auto.components.design.decision.multi', 'Pick one or more')}
          </p>
        ) : null}
      </div>

      {open ? (
        <>
          <div className="divide-y divide-border/60 border-t border-border">
            {decision.options.map((option, index) => (
              <NativeChatQuestionOptionRow
                key={option.label}
                badge={String(index + 1)}
                label={option.label}
                description={option.description}
                selected={selected.includes(index)}
                disabled={submitting}
                onSelect={() =>
                  setSelected((current) => toggleSelection(current, index, decision.multiSelect))
                }
              />
            ))}
          </div>
          <div className="space-y-2 border-t border-border px-3.5 py-2.5">
            <Textarea
              value={note}
              maxLength={DESIGN_MESSAGE_MAX_CHARS}
              disabled={submitting}
              onChange={(event) => setNote(event.target.value)}
              placeholder={translate(
                'auto.components.design.decision.notePlaceholder',
                'Add a note for the agent (optional)'
              )}
              className="min-h-12"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={submitting || !canAnswer}
                onClick={() => void submit()}
              >
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {translate('auto.components.design.decision.answer', 'Answer')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-1 border-t border-border px-3.5 py-2.5">
          {revision ? (
            <p className="text-[11px] text-muted-foreground">
              {translate('auto.components.design.decision.originalAnswer', 'Original answer')}
            </p>
          ) : null}
          {decision.answer?.selected.map((label) =>
            revision ? (
              <div
                key={label}
                data-design-decision-superseded=""
                className="flex items-start gap-2 text-sm text-muted-foreground line-through"
              >
                <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />
                <span className="break-words">{label}</span>
              </div>
            ) : (
              <div key={label} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={3} />
                <span className="break-words">{label}</span>
              </div>
            )
          )}
          {decision.answer?.note ? (
            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {decision.answer.note}
            </p>
          ) : null}
          {decision.answer ? (
            <p className="text-[11px] text-muted-foreground">
              {translate('auto.components.design.decision.answeredAt', 'Answered {{value0}}', {
                value0: formatDesignTimestamp(decision.answer.at)
              })}
            </p>
          ) : null}
          {revision ? (
            <div
              data-design-decision-revision=""
              className="mt-1.5 space-y-0.5 rounded-md bg-muted px-2.5 py-2"
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {translate(
                  'auto.components.design.decision.revisedAt',
                  'Updated later · {{value0}}',
                  { value0: formatDesignTimestamp(revision.at) }
                )}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {revision.text}
              </p>
            </div>
          ) : null}
          {processing ? <DesignProcessingInline /> : null}
        </div>
      )}
    </div>
  )
}
