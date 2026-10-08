import { createHash } from 'node:crypto'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import type {
  AgentJournalApprovalItem,
  AgentJournalQuestion,
  AgentJournalRenderItem
} from '../../shared/agent-session-journal-types'
import { agentSessionPromptQuestions } from '../../shared/agent-session-question-answer'
import { parseApprovalEnvelope } from '../../shared/agent-prompt-answer-keys'
import { parseAskFromStatus, type AskQuestion } from '../../shared/native-chat-ask'
import { telegramAnswerText } from './telegram-answer-text'
import { parseStructuredAgentSessionTabId } from '../../shared/structured-agent-session-tab-id'

/** A structured session's journal as the host holds it: the pending prompt plus the fence a reply must carry. */
export type TelegramStructuredPromptSnapshot = {
  fence: number
  items: readonly AgentJournalRenderItem[]
}

export type TelegramStructuredPromptReader = (
  sessionId: string
) => TelegramStructuredPromptSnapshot | null

type StructuredPromptIdentity = {
  sessionId: string
  fence: number
  itemId: string
  revision: number
}

/** The prompt a pane is paused on, normalized so buttons and answers share one shape. */
export type TelegramAnswerablePrompt =
  | { source: 'pty'; kind: 'approval'; tag: string; tool: string; summary?: string }
  | { source: 'pty'; kind: 'question'; tag: string; questions: AskQuestion[] }
  | (StructuredPromptIdentity & {
      source: 'structured'
      kind: 'approval'
      tag: string
      body: AgentJournalApprovalItem
    })
  | (StructuredPromptIdentity & {
      source: 'structured'
      kind: 'question'
      tag: string
      /** Ids are the host's question ids, so answers map back exactly. */
      questions: AgentJournalQuestion[]
    })

const PAUSED_STATES: ReadonlySet<string> = new Set(['blocked', 'waiting'])

function promptTag(identity: string): string {
  return createHash('sha256').update(identity).digest('hex').slice(0, 8)
}

export function telegramStructuredSessionIdForEntry(entry: AgentStatusEntry): string | null {
  const tabId = entry.tabId ?? entry.paneKey.slice(0, entry.paneKey.lastIndexOf(':'))
  return parseStructuredAgentSessionTabId(tabId)
}

function isPendingPrompt(item: AgentJournalRenderItem): boolean {
  return (
    (item.body.kind === 'approval' || item.body.kind === 'question') &&
    item.body.resolution.state === 'pending'
  )
}

function resolveStructuredPrompt(
  sessionId: string,
  readStructuredPrompt: TelegramStructuredPromptReader
): TelegramAnswerablePrompt | null {
  const snapshot = readStructuredPrompt(sessionId)
  const item = snapshot?.items.find(isPendingPrompt)
  if (!snapshot || !item) {
    return null
  }
  const identity: StructuredPromptIdentity = {
    sessionId,
    fence: snapshot.fence,
    itemId: item.itemId,
    revision: item.revision
  }
  const tag = promptTag(`structured:${sessionId}:${item.itemId}:${item.revision}`)
  if (item.body.kind === 'approval') {
    return { ...identity, source: 'structured', kind: 'approval', tag, body: item.body }
  }
  if (item.body.kind !== 'question') {
    return null
  }
  return {
    ...identity,
    source: 'structured',
    kind: 'question',
    tag,
    questions: agentSessionPromptQuestions(item.body)
  }
}

/** Null when the pane is not paused on something a button or reply can answer. */
export function resolveTelegramAnswerablePrompt(
  entry: AgentStatusEntry,
  readStructuredPrompt: TelegramStructuredPromptReader
): TelegramAnswerablePrompt | null {
  if (!PAUSED_STATES.has(entry.state)) {
    return null
  }
  const sessionId = telegramStructuredSessionIdForEntry(entry)
  if (sessionId) {
    return resolveStructuredPrompt(sessionId, readStructuredPrompt)
  }
  if (!entry.interactivePrompt) {
    return null
  }
  const tag = promptTag(`pty:${entry.interactivePrompt}`)
  const ask = parseAskFromStatus(entry.interactivePrompt, entry.toolName)
  if (ask) {
    return { source: 'pty', kind: 'question', tag, questions: ask.questions }
  }
  const approval = parseApprovalEnvelope(entry.interactivePrompt)
  return approval ? { source: 'pty', kind: 'approval', tag, ...approval } : null
}

/** Option labels an approval offers, in button order. */
export function telegramApprovalOptionLabels(prompt: TelegramAnswerablePrompt): string[] {
  if (prompt.kind !== 'approval') {
    return []
  }
  return prompt.source === 'structured'
    ? prompt.body.options.map((option) => option.label)
    : [telegramAnswerText.allow(), telegramAnswerText.deny()]
}

// Two-digit indices in the action grammar; Telegram caps a keyboard at 100 buttons.
export const TELEGRAM_MAX_PROMPT_QUESTIONS = 4
export const TELEGRAM_MAX_PROMPT_OPTIONS = 20

/** A partial keyboard could never submit, so oversized prompts get no buttons at all. */
export function telegramPromptFitsButtons(prompt: TelegramAnswerablePrompt): boolean {
  if (prompt.kind === 'approval') {
    return telegramApprovalOptionLabels(prompt).length <= TELEGRAM_MAX_PROMPT_OPTIONS
  }
  return (
    prompt.questions.length <= TELEGRAM_MAX_PROMPT_QUESTIONS &&
    prompt.questions.every((question) => question.options.length <= TELEGRAM_MAX_PROMPT_OPTIONS)
  )
}

/** True when the agent accepts typed text for this question beyond its offered options. */
export function telegramQuestionAcceptsFreeText(
  prompt: Extract<TelegramAnswerablePrompt, { kind: 'question' }>,
  questionIndex: number
): boolean {
  // Claude's selector always appends "Type something"; Codex attaches notes.
  return (
    prompt.source === 'pty' || prompt.questions[questionIndex]?.freeTextQuestionId !== undefined
  )
}

// Callback actions: `<tag>.a<i>` approval option, `<tag>.o<q>.<i>` question option, `<tag>.s` submit.
export type TelegramPromptAction =
  | { tag: string; kind: 'approval'; optionIndex: number }
  | { tag: string; kind: 'option'; questionIndex: number; optionIndex: number }
  | { tag: string; kind: 'submit' }

export function encodeTelegramPromptAction(action: TelegramPromptAction): string {
  switch (action.kind) {
    case 'approval':
      return `${action.tag}.a${action.optionIndex}`
    case 'option':
      return `${action.tag}.o${action.questionIndex}.${action.optionIndex}`
    case 'submit':
      return `${action.tag}.s`
  }
}

const ACTION_RE = /^([0-9a-f]{8})\.(?:a(\d{1,2})|o(\d{1,2})\.(\d{1,2})|(s))$/

export function decodeTelegramPromptAction(action: string): TelegramPromptAction | null {
  const match = ACTION_RE.exec(action)
  if (!match) {
    return null
  }
  const [, tag, approvalIndex, questionIndex, optionIndex, submit] = match
  if (!tag) {
    return null
  }
  if (approvalIndex !== undefined) {
    return { tag, kind: 'approval', optionIndex: Number(approvalIndex) }
  }
  if (questionIndex !== undefined && optionIndex !== undefined) {
    return {
      tag,
      kind: 'option',
      questionIndex: Number(questionIndex),
      optionIndex: Number(optionIndex)
    }
  }
  return submit ? { tag, kind: 'submit' } : null
}
