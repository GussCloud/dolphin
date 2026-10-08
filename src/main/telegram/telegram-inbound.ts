// Shared contract between the bridge (notices, transport) and inbound handlers (answers, channels).
import type { AgentStatusEntry } from '../../shared/agent-status-types'

export type TelegramPaneRoute = {
  /** Short, [A-Za-z0-9]{6,10}. */
  routeId: string
  paneKey: string
  worktreeId?: string
  terminalHandle?: string
  connectionId?: string | null
  agentType?: string
  /** interactivePrompt JSON at notice time; lets an answer detect a stale prompt. */
  interactivePrompt?: string
}

/** callback_data = `${routeId}:${action}`, at most 64 bytes. */
export type TelegramNoticeButton = { label: string; action: string }

export type TelegramNotice = {
  kind: 'blocked' | 'waiting' | 'done'
  /** Already formatted (HTML parse mode, escaped). */
  text: string
  /** PR1 always []. */
  buttons: TelegramNoticeButton[][]
}

export type TelegramCallbackEvent = {
  chatId: number
  messageId: number
  callbackQueryId: string
  route: TelegramPaneRoute
  action: string
}

export type TelegramTextEvent = {
  chatId: number
  messageId: number
  text: string
  /** Set when the message is a Telegram reply to one of our notices. */
  route?: TelegramPaneRoute
  /** Set by `/to <worktree> <text>`; the raw worktree query. */
  worktreeQuery?: string
}

export type TelegramInboundResult = { ok: true; ack?: string } | { ok: false; error: string }

export type TelegramInboundHandler = {
  handleCallback?(event: TelegramCallbackEvent): Promise<TelegramInboundResult>
  handleText?(event: TelegramTextEvent): Promise<TelegramInboundResult>
}

/** Extension seam: PR2 registers a decorator that fills `buttons` from interactivePrompt. */
export type TelegramNoticeDecorator = (
  notice: TelegramNotice,
  entry: AgentStatusEntry
) => TelegramNotice
