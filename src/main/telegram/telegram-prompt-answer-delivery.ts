import type { AgentStatusEntry } from '../../shared/agent-status-types'
import {
  isAskUserQuestionTool,
  type AgentQuestionAnsweredInferenceRequest
} from '../../shared/agent-question-answered-intent'
import {
  APPROVAL_ALLOW_KEYS,
  APPROVAL_DENY_KEYS,
  askAnswerKeyGroupBytes,
  planAskAnswerDelivery
} from '../../shared/agent-prompt-answer-keys'
import {
  isValidAgentSessionQuestionAnswers,
  type AgentSessionQuestionAnswer
} from '../../shared/agent-session-question-answer'
import { NATIVE_CHAT_QUESTION_STEP_MS } from '../../shared/native-chat-answer-stepping'
import type { AskAnswerSelection } from '../../shared/native-chat-ask'
import type { TelegramAnswerablePrompt } from './telegram-answerable-prompt'
import type { TelegramInboundResult } from './telegram-inbound'

/** `unknown` = the write may have landed (ack lost); never report it as a definite failure. */
export type TelegramDeliveryOutcome = 'accepted' | 'rejected' | 'unknown'

export type TelegramStructuredResponse = {
  sessionId: string
  fence: number
  kind: 'approval' | 'question'
  itemId: string
  expectedRevision: number
  optionId?: string
  answers?: AgentSessionQuestionAnswer[]
}

export type TelegramAnswerTransport = {
  /** Must go through the runtime `terminal.send` path so SSH/WSL panes and input locks behave as for mobile. */
  sendTerminal: (input: {
    terminal: string
    text: string
    enter: boolean
  }) => Promise<TelegramDeliveryOutcome>
  respondStructured: (response: TelegramStructuredResponse) => Promise<TelegramDeliveryOutcome>
  inferQuestionAnswered?: (request: AgentQuestionAnsweredInferenceRequest) => void
  wait: (ms: number) => Promise<void>
}

export const TELEGRAM_ANSWER_MESSAGES = {
  stale: 'pergunta já respondida',
  sent: 'resposta enviada',
  unconfirmed: 'resposta pode ter sido enviada; confira o terminal',
  partlySent: 'resposta enviada em parte; confira o terminal',
  notSent: 'não foi possível enviar a resposta',
  busy: 'outra resposta ainda está sendo enviada',
  noTerminal: 'terminal indisponível',
  useButtons: 'use os botões para responder a esta permissão',
  noFreeText: 'esta pergunta só aceita as opções dos botões',
  incomplete: 'responda todas as perguntas antes de enviar',
  structuredText: 'sessões de chat só aceitam respostas a perguntas pendentes',
  noWorktree: 'nenhum agente encontrado para esse worktree',
  ambiguousWorktree: 'mais de um agente nesse worktree; responda à notificação do agente'
} as const

export function telegramAnswerFailure(error: string): TelegramInboundResult {
  return { ok: false, error }
}

export function telegramOutcomeResult(outcome: TelegramDeliveryOutcome): TelegramInboundResult {
  if (outcome === 'accepted') {
    return { ok: true, ack: TELEGRAM_ANSWER_MESSAGES.sent }
  }
  return telegramAnswerFailure(
    outcome === 'unknown' ? TELEGRAM_ANSWER_MESSAGES.unconfirmed : TELEGRAM_ANSWER_MESSAGES.notSent
  )
}

async function sendKeyGroups(
  transport: TelegramAnswerTransport,
  terminal: string,
  groups: string[]
): Promise<TelegramInboundResult> {
  let accepted = 0
  for (let index = 0; index < groups.length; index += 1) {
    const outcome = await transport.sendTerminal({ terminal, text: groups[index]!, enter: false })
    if (outcome !== 'accepted') {
      // Any accepted key already moved the selector; a resend would double-step it.
      return accepted > 0
        ? telegramAnswerFailure(TELEGRAM_ANSWER_MESSAGES.partlySent)
        : telegramOutcomeResult(outcome)
    }
    accepted += 1
    if (index < groups.length - 1) {
      await transport.wait(NATIVE_CHAT_QUESTION_STEP_MS)
    }
  }
  return { ok: true, ack: TELEGRAM_ANSWER_MESSAGES.sent }
}

export async function deliverTelegramApproval(
  transport: TelegramAnswerTransport,
  terminal: string | undefined,
  prompt: Extract<TelegramAnswerablePrompt, { kind: 'approval' }>,
  optionIndex: number
): Promise<TelegramInboundResult> {
  if (prompt.source === 'structured') {
    const option = prompt.body.options[optionIndex]
    if (!option) {
      return telegramAnswerFailure(TELEGRAM_ANSWER_MESSAGES.stale)
    }
    return telegramOutcomeResult(
      await transport.respondStructured({
        sessionId: prompt.sessionId,
        fence: prompt.fence,
        kind: 'approval',
        itemId: prompt.itemId,
        expectedRevision: prompt.revision,
        optionId: option.id
      })
    )
  }
  const keys = [APPROVAL_ALLOW_KEYS, APPROVAL_DENY_KEYS][optionIndex]
  if (keys === undefined) {
    return telegramAnswerFailure(TELEGRAM_ANSWER_MESSAGES.stale)
  }
  if (!terminal) {
    return telegramAnswerFailure(TELEGRAM_ANSWER_MESSAGES.noTerminal)
  }
  return telegramOutcomeResult(await transport.sendTerminal({ terminal, text: keys, enter: false }))
}

function structuredAnswers(
  prompt: Extract<TelegramAnswerablePrompt, { source: 'structured'; kind: 'question' }>,
  selections: readonly AskAnswerSelection[]
): AgentSessionQuestionAnswer[] {
  return prompt.questions.map((question, index) => {
    const selection = selections[index]
    const other = selection?.other?.trim()
    return {
      questionId: question.id,
      optionIds: (selection?.indices ?? []).flatMap((option) => {
        const id = question.options[option]?.id
        return id ? [id] : []
      }),
      ...(other ? { other } : {})
    }
  })
}

export async function deliverTelegramQuestion(
  transport: TelegramAnswerTransport,
  entry: AgentStatusEntry,
  terminal: string | undefined,
  prompt: Extract<TelegramAnswerablePrompt, { kind: 'question' }>,
  selections: AskAnswerSelection[]
): Promise<TelegramInboundResult> {
  if (prompt.source === 'structured') {
    const answers = structuredAnswers(prompt, selections)
    // The host requires every question answered; refuse before a round trip it would reject.
    if (!isValidAgentSessionQuestionAnswers(prompt.questions, answers)) {
      return telegramAnswerFailure(TELEGRAM_ANSWER_MESSAGES.incomplete)
    }
    return telegramOutcomeResult(
      await transport.respondStructured({
        sessionId: prompt.sessionId,
        fence: prompt.fence,
        kind: 'question',
        itemId: prompt.itemId,
        expectedRevision: prompt.revision,
        answers
      })
    )
  }
  if (!terminal) {
    return telegramAnswerFailure(TELEGRAM_ANSWER_MESSAGES.noTerminal)
  }
  const delivery = planAskAnswerDelivery(
    entry.agentType,
    { questions: prompt.questions },
    selections
  )
  const result =
    delivery.kind === 'paste'
      ? // Same bytes mobile pastes: one line per question, committed with Enter.
        telegramOutcomeResult(
          await transport.sendTerminal({ terminal, text: delivery.text, enter: true })
        )
      : await sendKeyGroups(transport, terminal, delivery.groups.map(askAnswerKeyGroupBytes))
  if (result.ok && delivery.kind === 'keys' && isAskUserQuestionTool(entry.toolName)) {
    // Claude emits no hook after an answered question; the host re-validates this baseline.
    transport.inferQuestionAnswered?.({
      paneKey: entry.paneKey,
      baselineUpdatedAt: entry.updatedAt,
      baselineStateStartedAt: entry.stateStartedAt,
      baselinePrompt: entry.prompt,
      baselineAgentType: entry.agentType
    })
  }
  return result
}
