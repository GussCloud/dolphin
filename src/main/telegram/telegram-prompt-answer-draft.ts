import type { AskAnswerSelection, AskQuestion } from '../../shared/native-chat-ask'

// Telegram delivers one tap at a time, so a multi-question or multi-select answer
// is collected here and sent as one keystroke plan once it is complete.

/** Multi-select questions never complete on a tap; the user must press Send. */
export function telegramQuestionsNeedSubmit(questions: readonly AskQuestion[]): boolean {
  return questions.some((question) => question.multiSelect)
}

function isAnswered(selection: AskAnswerSelection | undefined): boolean {
  return (selection?.indices.length ?? 0) > 0 || (selection?.other ?? '').trim().length > 0
}

export function isTelegramAnswerDraftComplete(
  questions: readonly AskQuestion[],
  selections: readonly AskAnswerSelection[]
): boolean {
  return questions.every((_, index) => isAnswered(selections[index]))
}

/** Single-select replaces the pick; multi-select toggles it. Null for an out-of-range tap. */
export function applyTelegramOptionPick(
  questions: readonly AskQuestion[],
  selections: readonly AskAnswerSelection[],
  questionIndex: number,
  optionIndex: number
): AskAnswerSelection[] | null {
  const question = questions[questionIndex]
  if (!question || optionIndex < 0 || optionIndex >= question.options.length) {
    return null
  }
  const next = questions.map((_, index) => selections[index] ?? { indices: [] })
  const current = next[questionIndex]!
  if (!question.multiSelect) {
    // Single-select carries one value; a tap replaces any typed answer too.
    next[questionIndex] = { indices: [optionIndex] }
    return next
  }
  const indices = current.indices.includes(optionIndex)
    ? current.indices.filter((index) => index !== optionIndex)
    : [...current.indices, optionIndex].sort((left, right) => left - right)
  next[questionIndex] = { ...current, indices }
  return next
}

/** Typed text answers the first unanswered question that accepts it, else joins a
 *  multi-select's toggled options. */
export function applyTelegramFreeText(
  questions: readonly AskQuestion[],
  selections: readonly AskAnswerSelection[],
  text: string,
  acceptsFreeText: (questionIndex: number) => boolean
): AskAnswerSelection[] | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  const unanswered = questions.findIndex(
    (_, index) => acceptsFreeText(index) && !isAnswered(selections[index])
  )
  const target =
    unanswered !== -1
      ? unanswered
      : questions.findIndex(
          (question, index) =>
            question.multiSelect && acceptsFreeText(index) && !selections[index]?.other?.trim()
        )
  if (target === -1) {
    return null
  }
  const next = questions.map((_, index) => selections[index] ?? { indices: [] })
  // Single-select routes typed text alone; multi-select keeps toggled options beside it.
  next[target] = questions[target]!.multiSelect
    ? { ...next[target]!, other: trimmed }
    : { indices: [], other: trimmed }
  return next
}

/** Human-readable summary of a partial draft, for the callback toast. */
export function describeTelegramAnswerDraft(
  questions: readonly AskQuestion[],
  selections: readonly AskAnswerSelection[]
): string {
  return questions
    .map((question, index) => {
      const selection = selections[index]
      const labels = (selection?.indices ?? []).map((option) => question.options[option]?.label)
      const other = selection?.other?.trim()
      const answer = [...labels, ...(other ? [other] : [])].filter(Boolean).join(', ')
      return `${questions.length > 1 ? `${index + 1}. ` : ''}${answer || '—'}`
    })
    .join('\n')
}
