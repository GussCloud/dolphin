import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { escapeAndClipTelegramText } from './telegram-agent-notice'
import { telegramAnswerText } from './telegram-answer-text'
import {
  encodeTelegramPromptAction,
  resolveTelegramAnswerablePrompt,
  telegramApprovalOptionLabels,
  telegramPromptFitsButtons,
  type TelegramAnswerablePrompt,
  type TelegramStructuredPromptReader
} from './telegram-answerable-prompt'
import { telegramQuestionsNeedSubmit } from './telegram-prompt-answer-draft'
import type {
  TelegramNotice,
  TelegramNoticeButton,
  TelegramNoticeDecorator
} from './telegram-inbound'

const MAX_BUTTON_LABEL_CHARS = 40
const MAX_EXTRA_QUESTION_CHARS = 300
// Telegram rejects messages over 4096 chars; leave room for PR1's resolved suffix.
const TELEGRAM_NOTICE_TEXT_BUDGET = 3900

type QuestionPrompt = Extract<TelegramAnswerablePrompt, { kind: 'question' }>

function shortLabel(text: string): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  return chars.length > MAX_BUTTON_LABEL_CHARS
    ? `${chars.slice(0, MAX_BUTTON_LABEL_CHARS - 1).join('')}…`
    : chars.join('')
}

function approvalButtons(prompt: TelegramAnswerablePrompt): TelegramNoticeButton[][] {
  const buttons = telegramApprovalOptionLabels(prompt).map((label, optionIndex) => ({
    label: shortLabel(label),
    action: encodeTelegramPromptAction({ tag: prompt.tag, kind: 'approval', optionIndex })
  }))
  // Short decision sets read as one row; longer ones stack so labels are not clipped.
  return buttons.length <= 2 ? [buttons] : buttons.map((button) => [button])
}

function questionButtons(prompt: QuestionPrompt): TelegramNoticeButton[][] {
  const multiQuestion = prompt.questions.length > 1
  const rows = prompt.questions.flatMap((question, questionIndex) =>
    question.options.map((option, optionIndex) => [
      {
        label: shortLabel(`${multiQuestion ? `${questionIndex + 1}. ` : ''}${option.label}`),
        action: encodeTelegramPromptAction({
          tag: prompt.tag,
          kind: 'option',
          questionIndex,
          optionIndex
        })
      }
    ])
  )
  if (telegramQuestionsNeedSubmit(prompt.questions) || multiQuestion) {
    rows.push([
      {
        label: telegramAnswerText.submit(),
        action: encodeTelegramPromptAction({ tag: prompt.tag, kind: 'submit' })
      }
    ])
  }
  return rows
}

/** Lines appended under PR1's notice. PR1 prints a PTY prompt's first question from
 *  interactivePrompt; structured rows carry none, so theirs are all listed here. */
function questionLines(prompt: QuestionPrompt): string[] {
  const multiQuestion = prompt.questions.length > 1
  const first = prompt.source === 'pty' ? 1 : 0
  const listed = prompt.questions.slice(first).map((question, index) => {
    const label = multiQuestion ? `<b>${index + first + 1}.</b> ` : ''
    return `${label}${escapeAndClipTelegramText(question.question, MAX_EXTRA_QUESTION_CHARS)}`
  })
  const hints = telegramQuestionsNeedSubmit(prompt.questions)
    ? [telegramAnswerText.hintMultiSelect(), telegramAnswerText.hintReply()]
    : [telegramAnswerText.hintReply()]
  return [...listed, ...hints.map((hint) => `<i>${escapeAndClipTelegramText(hint, 200)}</i>`)]
}

/** Appends whole lines while they fit, so the notice never crosses Telegram's limit. */
function appendWithinBudget(text: string, lines: string[]): string {
  let result = text
  for (const [index, line] of lines.entries()) {
    const next = `${result}${index === 0 ? '\n\n' : '\n'}${line}`
    if (next.length > TELEGRAM_NOTICE_TEXT_BUDGET) {
      break
    }
    result = next
  }
  return result
}

/** Adds answer buttons to blocked/waiting notices whose pane is paused on a prompt. */
export function createTelegramPromptButtonDecorator(
  readStructuredPrompt: TelegramStructuredPromptReader
): TelegramNoticeDecorator {
  return (notice: TelegramNotice, entry: AgentStatusEntry): TelegramNotice => {
    if (notice.kind === 'done') {
      return notice
    }
    const prompt = resolveTelegramAnswerablePrompt(entry, readStructuredPrompt)
    if (!prompt || !telegramPromptFitsButtons(prompt)) {
      return notice
    }
    if (prompt.kind === 'approval') {
      const title =
        prompt.source === 'structured'
          ? [`🔐 ${escapeAndClipTelegramText(prompt.body.title, MAX_EXTRA_QUESTION_CHARS)}`]
          : []
      return {
        ...notice,
        text: appendWithinBudget(notice.text, title),
        buttons: [...notice.buttons, ...approvalButtons(prompt)]
      }
    }
    return {
      ...notice,
      text: appendWithinBudget(notice.text, questionLines(prompt)),
      buttons: [...notice.buttons, ...questionButtons(prompt)]
    }
  }
}
