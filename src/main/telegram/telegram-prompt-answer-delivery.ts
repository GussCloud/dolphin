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
import {
  buildAgentPromptPasteBytes,
  getAgentPromptSubmitDelayMs
} from '../../shared/agent-prompt-injection'
import { telegramAnswerText } from './telegram-answer-text'
import type { TelegramAnswerablePrompt } from './telegram-answerable-prompt'
import type { TelegramInboundResult } from './telegram-inbound'

/** `unknown` = the write may have landed (ack lost); never report it as a definite failure. */
export type TelegramDeliveryOutcome = 'accepted' | 'rejected' | 'unknown'
/** terminal.send's `requireAgentStatus: 'sendable'` refusals, before any byte is written. */
export type TelegramTerminalOutcome = TelegramDeliveryOutcome | 'no-agent' | 'permission'

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
    text?: string
    enter: boolean
    requireAgentStatus?: 'sendable'
  }) => Promise<TelegramTerminalOutcome>
  respondStructured: (response: TelegramStructuredResponse) => Promise<TelegramDeliveryOutcome>
  /** `agentSession.send` of one user text message, fenced like the host's own clients. */
  sendStructuredMessage: (input: {
    sessionId: string
    fence: number
    text: string
  }) => Promise<TelegramDeliveryOutcome>
  inferQuestionAnswered?: (request: AgentQuestionAnsweredInferenceRequest) => void
  wait: (ms: number) => Promise<void>
}

export function telegramAnswerFailure(error: string): TelegramInboundResult {
  return { ok: false, error }
}

export function telegramOutcomeResult(outcome: TelegramTerminalOutcome): TelegramInboundResult {
  switch (outcome) {
    case 'accepted':
      return { ok: true, ack: telegramAnswerText.sent() }
    case 'unknown':
      return telegramAnswerFailure(telegramAnswerText.unconfirmed())
    case 'no-agent':
      return telegramAnswerFailure(telegramAnswerText.noAgent())
    case 'permission':
      return telegramAnswerFailure(telegramAnswerText.useButtons())
    case 'rejected':
      return telegramAnswerFailure(telegramAnswerText.notSent())
  }
}

/** True when keys may already have reached the agent, so a repeat would answer twice. */
export function telegramAnswerMayHaveLanded(result: TelegramInboundResult): boolean {
  return (
    result.ok ||
    result.error === telegramAnswerText.unconfirmed() ||
    result.error === telegramAnswerText.partlySent()
  )
}

/** Free text into an agent TUI, guarded both phases so a dead agent's shell never runs it. */
export async function deliverTelegramPlainText(
  transport: TelegramAnswerTransport,
  terminal: string,
  text: string
): Promise<TelegramInboundResult> {
  const paste = buildAgentPromptPasteBytes(text)
  const pasted = await transport.sendTerminal({
    terminal,
    text: paste,
    enter: false,
    requireAgentStatus: 'sendable'
  })
  if (pasted !== 'accepted') {
    return telegramOutcomeResult(pasted)
  }
  await transport.wait(
    getAgentPromptSubmitDelayMs(process.platform, Buffer.byteLength(paste, 'utf8'))
  )
  const submitted = await transport.sendTerminal({
    terminal,
    enter: true,
    requireAgentStatus: 'sendable'
  })
  return submitted === 'accepted'
    ? { ok: true, ack: telegramAnswerText.sent() }
    : telegramAnswerFailure(telegramAnswerText.textNotSubmitted())
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
        ? telegramAnswerFailure(telegramAnswerText.partlySent())
        : telegramOutcomeResult(outcome)
    }
    accepted += 1
    if (index < groups.length - 1) {
      await transport.wait(NATIVE_CHAT_QUESTION_STEP_MS)
    }
  }
  return { ok: true, ack: telegramAnswerText.sent() }
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
      return telegramAnswerFailure(telegramAnswerText.stale())
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
    return telegramAnswerFailure(telegramAnswerText.stale())
  }
  if (!terminal) {
    return telegramAnswerFailure(telegramAnswerText.noTerminal())
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
      return telegramAnswerFailure(telegramAnswerText.incomplete())
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
    return telegramAnswerFailure(telegramAnswerText.noTerminal())
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
