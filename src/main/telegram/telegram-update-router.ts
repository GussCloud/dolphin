// Inbound side of the bridge: allowlist gate, bot commands, and dispatch of
// replies/callbacks to the registered inbound handler.
import { translateMain } from '../i18n/main-i18n'
import { escapeTelegramHtml } from './telegram-agent-notice'
import type {
  TelegramIncomingCallback,
  TelegramIncomingMessage,
  TelegramUpdate
} from './telegram-bot-api'
import type {
  TelegramInboundHandler,
  TelegramInboundResult,
  TelegramTextEvent
} from './telegram-inbound'
import type { TelegramReplyRoutes } from './telegram-reply-routes'

export type TelegramParsedText =
  | { kind: 'command'; command: string; args: string }
  | { kind: 'to'; worktreeQuery: string; text: string }
  | { kind: 'text'; text: string }

/** `/cmd@bot args` -> command; `/to <worktree> <text>` -> targeted text; else plain text. */
export function parseTelegramText(raw: string): TelegramParsedText | null {
  const text = raw.trim()
  if (!text) {
    return null
  }
  const match = /^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/.exec(text)
  if (!match) {
    return { kind: 'text', text }
  }
  const command = match[1].toLowerCase()
  const args = (match[2] ?? '').trim()
  if (command === 'to') {
    const target = /^(\S+)\s+([\s\S]+)$/.exec(args)
    // Why: `/to name` without text falls through to the help reply.
    return target
      ? { kind: 'to', worktreeQuery: target[1], text: target[2].trim() }
      : { kind: 'command', command, args }
  }
  return { kind: 'command', command, args }
}

export type TelegramUpdateRouterDeps = {
  routes: TelegramReplyRoutes
  isChatAllowed: (chatId: number) => boolean
  consumePairingCode: (code: string, chat: { chatId: number; label: string }) => boolean
  getInboundHandler: (method: keyof TelegramInboundHandler) => TelegramInboundHandler | undefined
  /** Already-HTML status listing for `/status`. */
  describeStatus: () => string
  reply: (chatId: number, html: string, replyToMessageId?: number) => Promise<void>
  answerCallback: (callbackQueryId: string, text?: string) => Promise<void>
  now?: () => number
}

/** Messages older than this are redeliveries (e.g. after a restart) and are not acted on. */
const STALE_MESSAGE_MS = 2 * 60_000

export function telegramHelpText(): string {
  return [
    translateMain('telegram.help.title', 'Dolphin agent notices'),
    '',
    `/status — ${translateMain('telegram.help.status', 'agents waiting, blocked or working')}`,
    `/to &lt;workspace&gt; &lt;text&gt; — ${translateMain('telegram.help.to', 'send text to an agent in that workspace')}`,
    translateMain('telegram.help.reply', 'Reply to a notice to answer that agent.'),
    `/help — ${translateMain('telegram.help.help', 'this message')}`
  ].join('\n')
}

function notSupportedText(): string {
  return translateMain('telegram.reply.notSupported', 'Replies are not supported yet.')
}

export class TelegramUpdateRouter {
  constructor(private readonly deps: TelegramUpdateRouterDeps) {}

  async route(update: TelegramUpdate): Promise<void> {
    if (update.callbackQuery) {
      await this.routeCallback(update.callbackQuery)
    }
    if (update.message?.text !== undefined) {
      await this.routeMessage(update.message)
    }
  }

  private async routeMessage(message: TelegramIncomingMessage): Promise<void> {
    const now = this.deps.now?.() ?? Date.now()
    if (message.sentAt !== undefined && now - message.sentAt > STALE_MESSAGE_MS) {
      return
    }
    const parsed = parseTelegramText(message.text ?? '')
    const allowed = this.deps.isChatAllowed(message.chatId)
    if (!allowed) {
      // Why: unknown chats get no reply at all; only a valid /pair proves the user holds the code.
      // Private chats only: in a group, anyone who sees the code could steer agents.
      if (
        message.chatType === 'private' &&
        parsed?.kind === 'command' &&
        parsed.command === 'pair' &&
        parsed.args
      ) {
        if (
          this.deps.consumePairingCode(parsed.args, {
            chatId: message.chatId,
            label: message.chatLabel
          })
        ) {
          await this.deps.reply(
            message.chatId,
            translateMain(
              'telegram.pair.success',
              'Paired. This chat now receives Dolphin agent notices.'
            )
          )
        }
      }
      return
    }
    if (!parsed) {
      return
    }
    if (parsed.kind === 'command') {
      await this.routeCommand(message, parsed.command)
      return
    }
    const event: TelegramTextEvent =
      parsed.kind === 'to'
        ? {
            chatId: message.chatId,
            messageId: message.messageId,
            text: parsed.text,
            worktreeQuery: parsed.worktreeQuery
          }
        : {
            chatId: message.chatId,
            messageId: message.messageId,
            text: parsed.text,
            ...this.replyRoute(message)
          }
    const handler = this.deps.getInboundHandler('handleText')
    const result: TelegramInboundResult = handler?.handleText
      ? await handler
          .handleText(event)
          .catch((error: unknown) => ({ ok: false as const, error: String(error) }))
      : { ok: false, error: notSupportedText() }
    const replyText = result.ok ? result.ack : result.error
    if (replyText) {
      await this.deps.reply(message.chatId, escapeTelegramHtml(replyText), message.messageId)
    }
  }

  private replyRoute(message: TelegramIncomingMessage): Pick<TelegramTextEvent, 'route'> {
    const route =
      message.replyToMessageId !== undefined
        ? this.deps.routes.resolveMessage(message.chatId, message.replyToMessageId)
        : undefined
    return route ? { route } : {}
  }

  private async routeCommand(message: TelegramIncomingMessage, command: string): Promise<void> {
    switch (command) {
      case 'status':
        await this.deps.reply(message.chatId, this.deps.describeStatus())
        return
      case 'pair':
        await this.deps.reply(
          message.chatId,
          translateMain('telegram.pair.already', 'This chat is already paired.')
        )
        return
      default:
        await this.deps.reply(message.chatId, telegramHelpText())
    }
  }

  private async routeCallback(callback: TelegramIncomingCallback): Promise<void> {
    if (callback.chatId === undefined || !this.deps.isChatAllowed(callback.chatId)) {
      return
    }
    const parsed = callback.data ? this.deps.routes.parseCallbackData(callback.data) : null
    const handler = this.deps.getInboundHandler('handleCallback')
    if (callback.data && !parsed) {
      // Why: routes are in-memory and bounded, so a restart or eviction orphans old buttons.
      await this.deps.answerCallback(
        callback.id,
        translateMain('telegram.callback.expired', 'This message expired. Use the latest notice.')
      )
      return
    }
    if (!parsed || !handler?.handleCallback || callback.messageId === undefined) {
      await this.deps.answerCallback(callback.id, notSupportedText())
      return
    }
    const result = await handler
      .handleCallback({
        chatId: callback.chatId,
        messageId: callback.messageId,
        callbackQueryId: callback.id,
        route: parsed.route,
        action: parsed.action
      })
      .catch((error: unknown): TelegramInboundResult => ({ ok: false, error: String(error) }))
    await this.deps.answerCallback(callback.id, result.ok ? result.ack : result.error)
  }
}
