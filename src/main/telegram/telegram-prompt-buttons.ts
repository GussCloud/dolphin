import type { AgentStatusEntry } from '../../shared/agent-status-types'
import {
  encodeTelegramPromptAction,
  resolveTelegramAnswerablePrompt,
  telegramApprovalOptionLabels,
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
// Two-digit indices in the action grammar, and Telegram caps a keyboard at 100 buttons.
const MAX_OPTIONS_PER_QUESTION = 20
const MAX_QUESTIONS = 4

function shortLabel(text: string): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  return chars.length > MAX_BUTTON_LABEL_CHARS
    ? `${chars.slice(0, MAX_BUTTON_LABEL_CHARS - 1).join('')}…`
    : chars.join('')
}

function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function approvalButtons(prompt: TelegramAnswerablePrompt): TelegramNoticeButton[][] {
  const buttons = telegramApprovalOptionLabels(prompt)
    .slice(0, MAX_OPTIONS_PER_QUESTION)
    .map((label, optionIndex) => ({
      label: shortLabel(label),
      action: encodeTelegramPromptAction({ tag: prompt.tag, kind: 'approval', optionIndex })
    }))
  // Short decision sets read as one row; longer ones stack so labels are not clipped.
  return buttons.length <= 2 ? [buttons] : buttons.map((button) => [button])
}

function questionButtons(
  prompt: Extract<TelegramAnswerablePrompt, { kind: 'question' }>
): TelegramNoticeButton[][] {
  const multiQuestion = prompt.questions.length > 1
  const rows = prompt.questions.slice(0, MAX_QUESTIONS).flatMap((question, questionIndex) =>
    question.options.slice(0, MAX_OPTIONS_PER_QUESTION).map((option, optionIndex) => [
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
      { label: 'Enviar', action: encodeTelegramPromptAction({ tag: prompt.tag, kind: 'submit' }) }
    ])
  }
  return rows
}

function questionText(prompt: Extract<TelegramAnswerablePrompt, { kind: 'question' }>): string {
  const multiQuestion = prompt.questions.length > 1
  return prompt.questions
    .slice(0, MAX_QUESTIONS)
    .map((question, index) => {
      const prefix = multiQuestion ? `${index + 1}. ` : ''
      const hint = question.multiSelect ? ' (várias opções; toque Enviar)' : ''
      return `<b>${escapeTelegramHtml(`${prefix}${question.question}`)}</b>${hint}`
    })
    .join('\n')
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
    if (!prompt) {
      return notice
    }
    if (prompt.kind === 'approval') {
      return { ...notice, buttons: [...notice.buttons, ...approvalButtons(prompt)] }
    }
    return {
      ...notice,
      text: `${notice.text}\n\n${questionText(prompt)}\n<i>Responda a esta mensagem para digitar uma resposta.</i>`,
      buttons: [...notice.buttons, ...questionButtons(prompt)]
    }
  }
}
