import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { hasAskAnswer, type AskAnswerSelection } from '../../shared/native-chat-ask'
import {
  decodeTelegramPromptAction,
  resolveTelegramAnswerablePrompt,
  telegramPromptFitsButtons,
  telegramQuestionAcceptsFreeText,
  telegramStructuredSessionIdForEntry,
  type TelegramAnswerablePrompt,
  type TelegramStructuredPromptReader
} from './telegram-answerable-prompt'
import {
  applyTelegramFreeText,
  applyTelegramOptionPick,
  describeTelegramAnswerDraft,
  isTelegramAnswerDraftComplete,
  telegramQuestionsNeedSubmit
} from './telegram-prompt-answer-draft'
import {
  deliverTelegramApproval,
  deliverTelegramPlainText,
  deliverTelegramQuestion,
  telegramAnswerFailure as fail,
  telegramAnswerMayHaveLanded,
  telegramOutcomeResult,
  type TelegramAnswerTransport,
  type TelegramDeliveryReport
} from './telegram-prompt-answer-delivery'
import { telegramAnswerText } from './telegram-answer-text'
import { TelegramAnsweredPrompts } from './telegram-answered-prompts'
import type {
  TelegramCallbackEvent,
  TelegramInboundHandler,
  TelegramInboundResult,
  TelegramPaneRoute,
  TelegramTextEvent
} from './telegram-inbound'

export type TelegramPromptAnswerPorts = Omit<TelegramAnswerTransport, 'wait'> & {
  readEntry: (paneKey: string) => AgentStatusEntry | null
  readStructuredPrompt: TelegramStructuredPromptReader
  resolveWorktreeQuery?: (query: string) => { worktreeId: string; paneKeys: string[] }[]
  wait?: (ms: number) => Promise<void>
}

type QuestionPrompt = Extract<TelegramAnswerablePrompt, { kind: 'question' }>
type Draft = { tag: string; selections: AskAnswerSelection[] }
const MAX_DRAFTS = 200

/** Answers Telegram taps and replies against the pane's CURRENT prompt, never the notice's copy. */
export function createTelegramPromptAnswerService(
  ports: TelegramPromptAnswerPorts
): TelegramInboundHandler {
  const transport: TelegramAnswerTransport = {
    sendTerminal: ports.sendTerminal,
    respondStructured: ports.respondStructured,
    sendStructuredMessage: ports.sendStructuredMessage,
    inferQuestionAnswered: ports.inferQuestionAnswered,
    wait: ports.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  }
  const drafts = new Map<string, Draft>()
  // One composed answer per terminal/session: interleaved keystroke groups corrupt both.
  const inFlight = new Set<string>()
  const answered = new TelegramAnsweredPrompts()

  /** Runs one delivery and remembers the prompt once keys may have reached it. */
  function deliverOnce(
    entry: AgentStatusEntry,
    prompt: TelegramAnswerablePrompt,
    terminal: string | undefined,
    deliver: () => Promise<TelegramDeliveryReport>
  ): Promise<TelegramDeliveryReport> {
    return exclusive(exclusiveKey(prompt, terminal), async () => {
      const result = await deliver()
      if (telegramAnswerMayHaveLanded(result)) {
        answered.record(entry, prompt)
      }
      return result
    })
  }

  function saveDraft(routeId: string, draft: Draft): void {
    drafts.delete(routeId)
    drafts.set(routeId, draft)
    for (const oldest of drafts.keys()) {
      if (drafts.size <= MAX_DRAFTS) {
        break
      }
      drafts.delete(oldest)
    }
  }

  function draftSelections(routeId: string, tag: string): AskAnswerSelection[] {
    const draft = drafts.get(routeId)
    return draft?.tag === tag ? draft.selections : []
  }

  async function exclusive(
    key: string,
    run: () => Promise<TelegramDeliveryReport>
  ): Promise<TelegramDeliveryReport> {
    if (inFlight.has(key)) {
      return fail(telegramAnswerText.busy())
    }
    inFlight.add(key)
    try {
      return await run()
    } catch {
      return fail(telegramAnswerText.unconfirmed(), 'unknown')
    } finally {
      inFlight.delete(key)
    }
  }

  function exclusiveKey(prompt: TelegramAnswerablePrompt, terminal: string | undefined): string {
    return prompt.source === 'structured' ? `structured:${prompt.sessionId}` : `pty:${terminal}`
  }

  /** Sends a complete draft, or keeps collecting and echoes what is chosen so far. */
  async function advanceQuestionDraft(
    entry: AgentStatusEntry,
    route: TelegramPaneRoute,
    prompt: QuestionPrompt,
    selections: AskAnswerSelection[],
    submit: boolean
  ): Promise<TelegramInboundResult> {
    const complete =
      !telegramQuestionsNeedSubmit(prompt.questions) &&
      isTelegramAnswerDraftComplete(prompt.questions, selections)
    if (!submit && !complete) {
      saveDraft(route.routeId, { tag: prompt.tag, selections })
      return { ok: true, ack: describeTelegramAnswerDraft(prompt.questions, selections) }
    }
    if (!hasAskAnswer({ questions: prompt.questions }, selections)) {
      return fail(telegramAnswerText.incomplete())
    }
    const terminal = entry.terminalHandle ?? route.terminalHandle
    const result = await deliverOnce(entry, prompt, terminal, () =>
      deliverTelegramQuestion(transport, entry, terminal, prompt, selections)
    )
    // Keep the draft only when nothing reached the agent, so a retry starts from it.
    if (telegramAnswerMayHaveLanded(result)) {
      drafts.delete(route.routeId)
    } else {
      saveDraft(route.routeId, { tag: prompt.tag, selections })
    }
    return result
  }

  async function handleCallback(event: TelegramCallbackEvent): Promise<TelegramInboundResult> {
    const { route } = event
    const action = decodeTelegramPromptAction(event.action)
    const entry = ports.readEntry(route.paneKey)
    // The notice's prompt JSON pins the question it was sent for.
    const pinned =
      entry &&
      (route.interactivePrompt === undefined || entry.interactivePrompt === route.interactivePrompt)
    const prompt =
      entry && pinned ? resolveTelegramAnswerablePrompt(entry, ports.readStructuredPrompt) : null
    if (!action || !entry || !prompt || prompt.tag !== action.tag) {
      drafts.delete(route.routeId)
      return fail(telegramAnswerText.stale())
    }
    if (answered.isAnswered(entry, prompt)) {
      return fail(telegramAnswerText.alreadyAnswered())
    }
    if (!telegramPromptFitsButtons(prompt)) {
      return fail(telegramAnswerText.answerInDolphin())
    }
    const terminal = entry.terminalHandle ?? route.terminalHandle
    if (prompt.kind === 'approval') {
      if (action.kind !== 'approval') {
        return fail(telegramAnswerText.stale())
      }
      return deliverOnce(entry, prompt, terminal, () =>
        deliverTelegramApproval(transport, terminal, prompt, action.optionIndex)
      )
    }
    const previous = draftSelections(route.routeId, prompt.tag)
    if (action.kind === 'submit') {
      return advanceQuestionDraft(entry, route, prompt, previous, true)
    }
    const next =
      action.kind === 'option'
        ? applyTelegramOptionPick(
            prompt.questions,
            previous,
            action.questionIndex,
            action.optionIndex
          )
        : null
    return next
      ? advanceQuestionDraft(entry, route, prompt, next, false)
      : fail(telegramAnswerText.stale())
  }

  function resolveTextRoute(event: TelegramTextEvent): TelegramPaneRoute | string {
    if (event.route) {
      return event.route
    }
    const matches = event.worktreeQuery
      ? (ports.resolveWorktreeQuery?.(event.worktreeQuery) ?? [])
      : []
    const paneKeys = matches.flatMap((match) => match.paneKeys)
    if (paneKeys.length !== 1) {
      return paneKeys.length === 0
        ? telegramAnswerText.noWorktree()
        : telegramAnswerText.ambiguousWorktree()
    }
    return { routeId: `to:${paneKeys[0]}`, paneKey: paneKeys[0]! }
  }

  async function handleText(event: TelegramTextEvent): Promise<TelegramInboundResult> {
    const route = resolveTextRoute(event)
    if (typeof route === 'string') {
      return fail(route)
    }
    const entry = ports.readEntry(route.paneKey)
    if (!entry) {
      return fail(telegramAnswerText.noTerminal())
    }
    const prompt = resolveTelegramAnswerablePrompt(entry, ports.readStructuredPrompt)
    if (prompt && answered.isAnswered(entry, prompt)) {
      return fail(telegramAnswerText.alreadyAnswered())
    }
    if (prompt && !telegramPromptFitsButtons(prompt)) {
      return fail(telegramAnswerText.answerInDolphin())
    }
    if (prompt?.kind === 'approval') {
      return fail(telegramAnswerText.useButtons())
    }
    if (prompt?.kind === 'question') {
      const next = applyTelegramFreeText(
        prompt.questions,
        draftSelections(route.routeId, prompt.tag),
        event.text,
        (index) => telegramQuestionAcceptsFreeText(prompt, index)
      )
      return next
        ? advanceQuestionDraft(entry, route, prompt, next, false)
        : fail(telegramAnswerText.noFreeText())
    }
    const sessionId = telegramStructuredSessionIdForEntry(entry)
    if (sessionId) {
      // A structured message is not keystrokes, so line breaks are kept.
      const message = event.text.trim()
      const snapshot = ports.readStructuredPrompt(sessionId)
      if (!snapshot || !message) {
        return fail(telegramAnswerText.structuredUnavailable())
      }
      return exclusive(`structured:${sessionId}`, async () =>
        telegramOutcomeResult(
          await ports.sendStructuredMessage({ sessionId, fence: snapshot.fence, text: message })
        )
      )
    }
    const terminal = entry.terminalHandle ?? route.terminalHandle
    const text = event.text.trim()
    if (!terminal || !text) {
      return fail(telegramAnswerText.noTerminal())
    }
    // Pasted, so line breaks stay inside one message; the guard refuses a terminal with no live agent.
    return exclusive(`pty:${terminal}`, () => deliverTelegramPlainText(transport, terminal, text))
  }

  // The landing is internal bookkeeping; the bridge sees the plain contract result.
  return {
    handleCallback: async (event) => withoutLanding(await handleCallback(event)),
    handleText: async (event) => withoutLanding(await handleText(event))
  }
}

function withoutLanding(result: TelegramInboundResult): TelegramInboundResult {
  return result.ok
    ? { ok: true, ...(result.ack !== undefined ? { ack: result.ack } : {}) }
    : { ok: false, error: result.error }
}
