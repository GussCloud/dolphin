// Outbound side: sends a decided notice (or its resolution edit) to every allowlisted chat.
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { buildTelegramAgentNotice, markTelegramNoticeResolved } from './telegram-agent-notice'
import type { TelegramBotApi, TelegramInlineButton } from './telegram-bot-api'
import type {
  TelegramNotice,
  TelegramNoticeButton,
  TelegramNoticeDecorator,
  TelegramPaneRoute
} from './telegram-inbound'
import type { TelegramOpenNotice, TelegramSentMessage } from './telegram-notice-transitions'
import { encodeTelegramCallbackData, type TelegramReplyRoutes } from './telegram-reply-routes'

/** Returning false suppresses the notice. */
export type TelegramNoticeFilter = (notice: TelegramNotice, entry: AgentStatusEntry) => boolean

/** Pane identity a route captures; both store entries and snapshot rows carry it. */
export type TelegramRouteSource = Pick<
  AgentStatusEntry,
  'paneKey' | 'worktreeId' | 'terminalHandle' | 'agentType' | 'interactivePrompt'
> & { connectionId?: string | null }

export type TelegramNoticeDeliveryDeps = {
  api: Pick<TelegramBotApi, 'sendMessage' | 'editMessageText'>
  routes: TelegramReplyRoutes
  allowedChatIds: () => number[]
  decorators: () => readonly TelegramNoticeDecorator[]
  filters: () => readonly TelegramNoticeFilter[]
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

function passesFilters(
  notice: TelegramNotice,
  entry: AgentStatusEntry,
  filters: readonly TelegramNoticeFilter[]
): boolean {
  return filters.every((filter) => {
    try {
      return filter(notice, entry)
    } catch (error) {
      console.error('[telegram] notice filter threw', error)
      return true
    }
  })
}

export function toTelegramInlineButtons(
  buttons: readonly TelegramNoticeButton[][],
  route: TelegramPaneRoute
): TelegramInlineButton[][] {
  return buttons
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
  entry: TelegramRouteSource
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
  if (!passesFilters(notice, entry, deps.filters())) {
    return null
  }
  const route = registerTelegramPaneRoute(deps.routes, entry)
  const messages = await sendTelegramToChats(deps, notice.text, {
    route,
    buttons: notice.buttons
  })
  return { notice, messages }
}

/** Sends already-HTML text to every allowed chat; a route binds the copies and enables buttons. */
export async function sendTelegramToChats(
  deps: Pick<TelegramNoticeDeliveryDeps, 'api' | 'routes' | 'allowedChatIds'>,
  html: string,
  opts: {
    route?: TelegramPaneRoute
    buttons?: readonly TelegramNoticeButton[][]
    threadUnderRoute?: boolean
  }
): Promise<TelegramSentMessage[]> {
  const { route } = opts
  if (opts.buttons?.length && !route) {
    console.warn('[telegram] dropping buttons sent without a route')
  }
  const buttons = route && opts.buttons ? toTelegramInlineButtons(opts.buttons, route) : []
  const messages: TelegramSentMessage[] = []
  for (const chatId of deps.allowedChatIds()) {
    const replyToMessageId =
      route && opts.threadUnderRoute
        ? deps.routes.latestMessageFor(route.routeId, chatId)
        : undefined
    try {
      const messageId = await deps.api.sendMessage(chatId, html, { buttons, replyToMessageId })
      if (route) {
        deps.routes.bindMessage(chatId, messageId, route.routeId)
      }
      messages.push({ chatId, messageId })
    } catch (error) {
      console.warn('[telegram] send to allowed chat failed', error)
    }
  }
  return messages
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
