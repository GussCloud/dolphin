import { describe, expect, it, vi } from 'vitest'
import {
  isPlausibleTelegramBotToken,
  parseTelegramUpdates,
  TelegramApiError,
  TelegramBotApi,
  type TelegramFetch
} from './telegram-bot-api'

const TOKEN = '123456789:AAEabcdefghijklmnopqrstuvwxyz012345'

function respond(status: number, body: unknown): TelegramFetch {
  return vi.fn(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  )
}

async function rejection(promise: Promise<unknown>): Promise<TelegramApiError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof TelegramApiError)) {
    throw new Error(`expected TelegramApiError, got ${String(error)}`)
  }
  return error
}

describe('TelegramBotApi', () => {
  it('posts JSON to the bot method and returns the parsed message id', async () => {
    const fetch = respond(200, { ok: true, result: { message_id: 77 } })
    const api = new TelegramBotApi(TOKEN, fetch)
    await expect(
      api.sendMessage(5, '<b>hi</b>', {
        replyToMessageId: 3,
        buttons: [[{ text: 'Yes', callbackData: 'abc123:y' }]]
      })
    ).resolves.toBe(77)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`)
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_id: 5,
      parse_mode: 'HTML',
      reply_parameters: { message_id: 3 },
      reply_markup: { inline_keyboard: [[{ text: 'Yes', callback_data: 'abc123:y' }]] }
    })
  })

  it.each([
    [401, 'invalid-token'],
    [404, 'invalid-token'],
    [409, 'conflict'],
    [400, 'rejected'],
    [502, 'network']
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const api = new TelegramBotApi(
      TOKEN,
      respond(status, { ok: false, error_code: status, description: 'nope' })
    )
    expect((await rejection(api.getMe())).kind).toBe(kind)
  })

  it('surfaces retry_after on 429', async () => {
    const api = new TelegramBotApi(
      TOKEN,
      respond(429, {
        ok: false,
        error_code: 429,
        description: 'slow',
        parameters: { retry_after: 12 }
      })
    )
    const error = await rejection(api.getMe())
    expect(error.kind).toBe('rate-limited')
    expect(error.retryAfterSec).toBe(12)
  })

  it('treats a non-JSON body as an HTTP failure', async () => {
    const api = new TelegramBotApi(TOKEN, respond(500, '<html>bad gateway</html>'))
    const error = await rejection(api.getMe())
    expect(error).toMatchObject({ kind: 'network', message: 'HTTP 500' })
  })

  it('redacts the token from transport errors', async () => {
    const api = new TelegramBotApi(TOKEN, async () => {
      throw new Error(`connect failed for /bot${TOKEN}/getMe`)
    })
    const error = await rejection(api.getMe())
    expect(error.kind).toBe('network')
    expect(error.message).not.toContain(TOKEN)
  })

  it('rethrows an abort instead of reporting a network failure', async () => {
    const controller = new AbortController()
    controller.abort()
    const api = new TelegramBotApi(TOKEN, async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(api.getUpdates(0, 30, controller.signal)).rejects.toThrow('aborted')
  })
})

describe('parseTelegramUpdates', () => {
  it('maps messages, replies and callbacks to domain shapes and drops junk', () => {
    expect(
      parseTelegramUpdates([
        {
          update_id: 10,
          message: {
            message_id: 3,
            date: 1_700_000_000,
            chat: { id: 99, type: 'private', first_name: 'Ana', last_name: 'Lima' },
            text: '/pair ABC',
            reply_to_message: { message_id: 2 }
          }
        },
        {
          update_id: 11,
          callback_query: {
            id: 'cb',
            data: 'r1:y',
            message: { message_id: 4, chat: { id: 99, username: 'ana' } }
          }
        },
        { update_id: 'x' },
        null,
        { update_id: 12, message: { chat: { id: 1 } } }
      ])
    ).toEqual([
      {
        updateId: 10,
        message: {
          messageId: 3,
          chatId: 99,
          chatLabel: 'Ana Lima',
          chatType: 'private',
          sentAt: 1_700_000_000_000,
          text: '/pair ABC',
          replyToMessageId: 2
        }
      },
      { updateId: 11, callbackQuery: { id: 'cb', data: 'r1:y', chatId: 99, messageId: 4 } },
      { updateId: 12 }
    ])
  })

  it('returns nothing for a non-array result', () => {
    expect(parseTelegramUpdates({})).toEqual([])
  })
})

describe('isPlausibleTelegramBotToken', () => {
  it('accepts BotFather-shaped tokens only', () => {
    expect(isPlausibleTelegramBotToken(TOKEN)).toBe(true)
    expect(isPlausibleTelegramBotToken('123:short')).toBe(false)
  })
})
