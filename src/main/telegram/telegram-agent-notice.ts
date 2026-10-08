// Pure: one status-store row -> the Telegram notice for it (HTML parse mode).
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { formatAgentTypeLabel } from '../../shared/agent-type-label'
import { translateMain } from '../i18n/main-i18n'
import type { TelegramNotice } from './telegram-inbound'

// Escaped-length budgets; their sum stays well under Telegram's 4096-char message cap,
// so the resolution footer can always be appended without cutting a tag.
const SUMMARY_MAX = 2500
const DETAIL_MAX = 400
const PROMPT_MAX = 300
const NAME_MAX = 120

export type TelegramNoticeKind = TelegramNotice['kind']

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escapes, then clips to `max` escaped chars without splitting an entity. */
export function escapeAndClipTelegramText(value: string, max: number): string {
  const escaped = escapeTelegramHtml(value.trim())
  if (escaped.length <= max) {
    return escaped
  }
  return `${escaped
    .slice(0, max - 1)
    .replace(/&[a-z]*$/, '')
    .trimEnd()}…`
}

/** Which notice a row deserves, or null when it is not notice-worthy. */
export function telegramNoticeKindFor(entry: AgentStatusEntry): TelegramNoticeKind | null {
  if (entry.restoredUnconfirmed) {
    return null
  }
  if (entry.state === 'done') {
    return entry.sessionBoundary ? null : 'done'
  }
  return entry.state === 'blocked' || entry.state === 'waiting' ? entry.state : null
}

function readFirstQuestion(interactivePrompt: string | undefined): string | undefined {
  if (!interactivePrompt) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(interactivePrompt)
    if (typeof parsed !== 'object' || parsed === null || !('questions' in parsed)) {
      return undefined
    }
    const questions = parsed.questions
    if (!Array.isArray(questions)) {
      return undefined
    }
    const first: unknown = questions[0]
    return typeof first === 'object' &&
      first !== null &&
      'question' in first &&
      typeof first.question === 'string'
      ? first.question
      : undefined
  } catch {
    return undefined
  }
}

function headline(kind: TelegramNoticeKind, interrupted: boolean | undefined): string {
  switch (kind) {
    case 'blocked':
      return `⛔ ${translateMain('telegram.notice.blocked', 'Blocked')}`
    case 'waiting':
      return `⏳ ${translateMain('telegram.notice.waiting', 'Waiting for you')}`
    case 'done':
      return interrupted
        ? `⏹ ${translateMain('telegram.notice.stopped', 'Stopped')}`
        : `✅ ${translateMain('telegram.notice.done', 'Done')}`
  }
}

function attentionDetail(entry: AgentStatusEntry): string | undefined {
  const question = readFirstQuestion(entry.interactivePrompt)
  if (question) {
    return `❓ ${escapeAndClipTelegramText(question, DETAIL_MAX)}`
  }
  if (entry.toolName) {
    const input = entry.toolInput
      ? ` <code>${escapeAndClipTelegramText(entry.toolInput, DETAIL_MAX)}</code>`
      : ''
    return `🔧 ${escapeAndClipTelegramText(entry.toolName, NAME_MAX)}${input}`
  }
  return undefined
}

function doneSummary(entry: AgentStatusEntry): string | undefined {
  const summary =
    entry.lastCompletedAssistantMessage ??
    (entry.lastAssistantMessageIsToolOutput ? undefined : entry.lastAssistantMessage)
  return summary?.trim() ? escapeAndClipTelegramText(summary, SUMMARY_MAX) : undefined
}

export function buildTelegramAgentNotice(
  entry: AgentStatusEntry,
  worktreeName: string | null
): TelegramNotice | null {
  const kind = telegramNoticeKindFor(entry)
  if (!kind) {
    return null
  }
  const where = worktreeName?.trim()
    ? `<b>${escapeAndClipTelegramText(worktreeName, NAME_MAX)}</b> · `
    : ''
  const lines = [
    headline(kind, entry.interrupted),
    `${where}${escapeAndClipTelegramText(formatAgentTypeLabel(entry.agentType), NAME_MAX)}`
  ]
  if (entry.prompt.trim()) {
    lines.push(`💬 <i>${escapeAndClipTelegramText(entry.prompt, PROMPT_MAX)}</i>`)
  }
  const body = kind === 'done' ? doneSummary(entry) : attentionDetail(entry)
  if (body) {
    lines.push('', body)
  }
  return { kind, text: lines.join('\n'), buttons: [] }
}

export function markTelegramNoticeResolved(text: string): string {
  const label = escapeTelegramHtml(translateMain('telegram.notice.resolved', 'Answered'))
  return `${text}\n\n<i>✔ ${label}</i>`
}
