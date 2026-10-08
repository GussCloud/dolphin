// Anti-corruption layer over the Telegram Bot HTTP API: snake_case wire JSON in,
// camelCase domain shapes out. Every response body is read to completion (dolphin#8695).
import { getMainHttpClient } from '../network/http-client'

const TELEGRAM_API_ORIGIN = 'https://api.telegram.org'
const TELEGRAM_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/

export type TelegramFetch = (url: string, init: RequestInit) => Promise<Response>

export type TelegramApiErrorKind =
  | 'invalid-token'
  | 'conflict'
  | 'rate-limited'
  | 'network'
  | 'rejected'

export class TelegramApiError extends Error {
  constructor(
    readonly kind: TelegramApiErrorKind,
    message: string,
    readonly retryAfterSec?: number
  ) {
    super(message)
    this.name = 'TelegramApiError'
  }
}

export type TelegramInlineButton = { text: string; callbackData: string }

export type TelegramIncomingMessage = {
  messageId: number
  chatId: number
  chatLabel: string
  text?: string
  replyToMessageId?: number
}

export type TelegramIncomingCallback = {
  id: string
  data?: string
  chatId?: number
  messageId?: number
}

export type TelegramUpdate = {
  updateId: number
  message?: TelegramIncomingMessage
  callbackQuery?: TelegramIncomingCallback
}

export function isPlausibleTelegramBotToken(token: string): boolean {
  return TELEGRAM_TOKEN_PATTERN.test(token)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function chatLabelOf(chat: Record<string, unknown>): string {
  const username = readText(chat, 'username')
  return (
    readText(chat, 'title') ??
    (username ? `@${username}` : undefined) ??
    [readText(chat, 'first_name'), readText(chat, 'last_name')].filter(Boolean).join(' ')
  )
}

function parseMessage(raw: unknown): TelegramIncomingMessage | undefined {
  if (!isRecord(raw) || !isRecord(raw.chat)) {
    return undefined
  }
  const messageId = readNumber(raw, 'message_id')
  const chatId = readNumber(raw.chat, 'id')
  if (messageId === undefined || chatId === undefined) {
    return undefined
  }
  const replyTo = isRecord(raw.reply_to_message)
    ? readNumber(raw.reply_to_message, 'message_id')
    : undefined
  const text = readText(raw, 'text')
  return {
    messageId,
    chatId,
    chatLabel: chatLabelOf(raw.chat),
    ...(text !== undefined ? { text } : {}),
    ...(replyTo !== undefined ? { replyToMessageId: replyTo } : {})
  }
}

function parseCallback(raw: unknown): TelegramIncomingCallback | undefined {
  if (!isRecord(raw)) {
    return undefined
  }
  const id = readText(raw, 'id')
  if (!id) {
    return undefined
  }
  const message = parseMessage(raw.message)
  const data = readText(raw, 'data')
  return {
    id,
    ...(data !== undefined ? { data } : {}),
    ...(message ? { chatId: message.chatId, messageId: message.messageId } : {})
  }
}

export function parseTelegramUpdates(result: unknown): TelegramUpdate[] {
  if (!Array.isArray(result)) {
    return []
  }
  const updates: TelegramUpdate[] = []
  for (const raw of result) {
    if (!isRecord(raw)) {
      continue
    }
    const updateId = readNumber(raw, 'update_id')
    if (updateId === undefined) {
      continue
    }
    const message = parseMessage(raw.message)
    const callbackQuery = parseCallback(raw.callback_query)
    updates.push({
      updateId,
      ...(message ? { message } : {}),
      ...(callbackQuery ? { callbackQuery } : {})
    })
  }
  return updates
}

function toReplyMarkup(buttons: TelegramInlineButton[][] | undefined): unknown {
  return buttons && buttons.length > 0
    ? {
        inline_keyboard: buttons.map((row) =>
          row.map((button) => ({ text: button.text, callback_data: button.callbackData }))
        )
      }
    : undefined
}

export type TelegramSendOptions = {
  replyToMessageId?: number
  buttons?: TelegramInlineButton[][]
}

export class TelegramBotApi {
  private readonly fetchImpl: TelegramFetch

  constructor(
    private readonly token: string,
    fetchImpl?: TelegramFetch
  ) {
    this.fetchImpl = fetchImpl ?? ((url, init) => getMainHttpClient().fetch(url, init))
  }

  async getMe(): Promise<{ username: string }> {
    const result = await this.call('getMe', {})
    return { username: isRecord(result) ? (readText(result, 'username') ?? '') : '' }
  }

  async getUpdates(
    offset: number,
    timeoutSec: number,
    signal?: AbortSignal
  ): Promise<TelegramUpdate[]> {
    const result = await this.call(
      'getUpdates',
      { offset, timeout: timeoutSec, allowed_updates: ['message', 'callback_query'] },
      signal
    )
    return parseTelegramUpdates(result)
  }

  async sendMessage(
    chatId: number,
    html: string,
    options: TelegramSendOptions = {}
  ): Promise<number> {
    const result = await this.call('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: toReplyMarkup(options.buttons),
      ...(options.replyToMessageId !== undefined
        ? {
            reply_parameters: {
              message_id: options.replyToMessageId,
              allow_sending_without_reply: true
            }
          }
        : {})
    })
    const messageId = isRecord(result) ? readNumber(result, 'message_id') : undefined
    if (messageId === undefined) {
      throw new TelegramApiError('rejected', 'sendMessage returned no message id')
    }
    return messageId
  }

  async editMessageText(chatId: number, messageId: number, html: string): Promise<void> {
    await this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    })
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {})
    })
  }

  private redact(message: string): string {
    return message.split(this.token).join('<token>')
  }

  private async call(
    method: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    let response: Response
    let text: string
    try {
      response = await this.fetchImpl(`${TELEGRAM_API_ORIGIN}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {})
      })
      text = await response.text()
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }
      throw new TelegramApiError(
        'network',
        this.redact(error instanceof Error ? error.message : String(error))
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = undefined
    }
    if (isRecord(parsed) && parsed.ok === true) {
      return parsed.result
    }
    const description = this.redact(
      (isRecord(parsed) ? readText(parsed, 'description') : undefined) ?? `HTTP ${response.status}`
    )
    const status =
      (isRecord(parsed) ? readNumber(parsed, 'error_code') : undefined) ?? response.status
    if (status === 401 || status === 404) {
      throw new TelegramApiError('invalid-token', description)
    }
    if (status === 409) {
      throw new TelegramApiError('conflict', description)
    }
    if (status === 429) {
      const parameters = isRecord(parsed) && isRecord(parsed.parameters) ? parsed.parameters : {}
      throw new TelegramApiError(
        'rate-limited',
        description,
        readNumber(parameters, 'retry_after') ?? 5
      )
    }
    throw new TelegramApiError(status >= 500 ? 'network' : 'rejected', description)
  }
}
