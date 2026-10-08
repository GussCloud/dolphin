// Outbound side: sends a decided notice (or its resolution edit) to every allowlisted chat.
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { buildTelegramAgentNotice, markTelegramNoticeResolved } from './telegram-agent-notice'
import type { TelegramBotApi, TelegramInlineButton } from './telegram-bot-api'
import type { TelegramNotice, TelegramNoticeDecorator, TelegramPaneRoute } from './telegram-inbound'
import type { TelegramOpenNotice, TelegramSentMessage } from './telegram-notice-transitions'
import { encodeTelegramCallbackData, type TelegramReplyRoutes } from './telegram-reply-routes'

export type TelegramNoticeDeliveryDeps = {
  api: Pick<TelegramBotApi, 'sendMessage' | 'editMessageText'>
  routes: TelegramReplyRoutes
  allowedChatIds: () => number[]
  decorators: () => readonly TelegramNoticeDecorator[]
  resolveWorktreeName: (worktreeId: string) => string | null
}

function decorate(
  notice: TelegramNotice,
  entry: AgentStatusEntry,
  decorators: readonly TelegramNoticeDecorator[]
): TelegramNotice {
  let current = notice
  for (const decorator of decorators) {
    try {
      current = decorator(current, entry)
    } catch (error) {
      console.error('[telegram] notice decorator threw', error)
    }
  }
  return current
}

function toInlineButtons(
  notice: TelegramNotice,
  route: TelegramPaneRoute
): TelegramInlineButton[][] {
  return notice.buttons
    .map((row) =>
      row.flatMap((button) => {
        try {
          return [
            {
              text: button.label,
              callbackData: encodeTelegramCallbackData(route.routeId, button.action)
            }
          ]
        } catch (error) {
          console.warn('[telegram] dropping a notice button', error)
          return []
        }
      })
    )
    .filter((row) => row.length > 0)
}

export function registerTelegramPaneRoute(
  routes: TelegramReplyRoutes,
  entry: AgentStatusEntry
): TelegramPaneRoute {
  return routes.register({
    paneKey: entry.paneKey,
    ...(entry.worktreeId !== undefined ? { worktreeId: entry.worktreeId } : {}),
    ...(entry.terminalHandle !== undefined ? { terminalHandle: entry.terminalHandle } : {}),
    ...(entry.connectionId !== undefined ? { connectionId: entry.connectionId } : {}),
    ...(entry.agentType !== undefined ? { agentType: entry.agentType } : {}),
    ...(entry.interactivePrompt !== undefined ? { interactivePrompt: entry.interactivePrompt } : {})
  })
}

/** Sends the notice; returns what was sent, or null when the row formats to nothing. */
export async function deliverTelegramNotice(
  deps: TelegramNoticeDeliveryDeps,
  entry: AgentStatusEntry
): Promise<{ notice: TelegramNotice; messages: TelegramSentMessage[] } | null> {
  const name = entry.worktreeId ? deps.resolveWorktreeName(entry.worktreeId) : null
  const base = buildTelegramAgentNotice(entry, name)
  if (!base) {
    return null
  }
  const notice = decorate(base, entry, deps.decorators())
  const route = registerTelegramPaneRoute(deps.routes, entry)
  const buttons = toInlineButtons(notice, route)
  const messages: TelegramSentMessage[] = []
  for (const chatId of deps.allowedChatIds()) {
    try {
      const messageId = await deps.api.sendMessage(chatId, notice.text, { buttons })
      deps.routes.bindMessage(chatId, messageId, route.routeId)
      messages.push({ chatId, messageId })
    } catch (error) {
      console.warn('[telegram] notice send failed', error)
    }
  }
  return { notice, messages }
}

/** Edits each sent copy to read as answered; removes its buttons by omitting reply_markup. */
export async function resolveTelegramNotice(
  deps: Pick<TelegramNoticeDeliveryDeps, 'api'>,
  open: TelegramOpenNotice
): Promise<void> {
  const text = markTelegramNoticeResolved(open.text)
  for (const message of open.messages) {
    try {
      await deps.api.editMessageText(message.chatId, message.messageId, text)
    } catch (error) {
      console.warn('[telegram] notice resolution edit failed', error)
    }
  }
}
