import { describe, expect, it, vi } from 'vitest'
import type { TelegramInboundHandler } from './telegram-inbound'
import { TelegramReplyRoutes } from './telegram-reply-routes'
import { parseTelegramText, TelegramUpdateRouter } from './telegram-update-router'

vi.mock('electron', () => ({ app: { getLocale: () => 'en-US' } }))

const ALLOWED = 10
const STRANGER = 20

function makeRouter(handler?: TelegramInboundHandler) {
  const routes = new TelegramReplyRoutes(10, () => 'Route123')
  const deps = {
    routes,
    isChatAllowed: (chatId: number) => chatId === ALLOWED,
    consumePairingCode: vi.fn((code: string) => code === 'GOODCODE'),
    getInboundHandler: (method: keyof TelegramInboundHandler) =>
      handler && handler[method] ? handler : undefined,
    describeStatus: () => 'STATUS',
    reply: vi.fn(async (_chatId: number, _html: string, _replyToMessageId?: number) => {}),
    answerCallback: vi.fn(async () => {})
  }
  return { router: new TelegramUpdateRouter(deps), deps, routes }
}

function message(chatId: number, text: string, replyToMessageId?: number) {
  return {
    updateId: 1,
    message: {
      messageId: 5,
      chatId,
      chatLabel: '@me',
      text,
      ...(replyToMessageId ? { replyToMessageId } : {})
    }
  }
}

describe('parseTelegramText', () => {
  it('parses commands, bot-suffixed commands, /to and plain text', () => {
    expect(parseTelegramText('/status')).toEqual({ kind: 'command', command: 'status', args: '' })
    expect(parseTelegramText('/PAIR@dolphin_bot abc ')).toEqual({
      kind: 'command',
      command: 'pair',
      args: 'abc'
    })
    expect(parseTelegramText('/to api run the tests\nplease')).toEqual({
      kind: 'to',
      worktreeQuery: 'api',
      text: 'run the tests\nplease'
    })
    expect(parseTelegramText('/to api')).toBeNull()
    expect(parseTelegramText(' yes ')).toEqual({ kind: 'text', text: 'yes' })
    expect(parseTelegramText('   ')).toBeNull()
  })
})

describe('TelegramUpdateRouter', () => {
  it('drops every message from a non-allowlisted chat except a valid /pair', async () => {
    const handleText = vi.fn()
    const { router, deps } = makeRouter({ handleText })
    await router.route(message(STRANGER, '/status'))
    await router.route(message(STRANGER, 'hello'))
    await router.route(message(STRANGER, '/pair WRONG'))
    expect(deps.reply).not.toHaveBeenCalled()
    expect(handleText).not.toHaveBeenCalled()
    await router.route(message(STRANGER, '/pair GOODCODE'))
    expect(deps.consumePairingCode).toHaveBeenLastCalledWith('GOODCODE', {
      chatId: STRANGER,
      label: '@me'
    })
    expect(deps.reply).toHaveBeenCalledTimes(1)
  })

  it('answers /status and /help for an allowed chat', async () => {
    const { router, deps } = makeRouter()
    await router.route(message(ALLOWED, '/status'))
    expect(deps.reply).toHaveBeenLastCalledWith(ALLOWED, 'STATUS')
    await router.route(message(ALLOWED, '/start'))
    expect(vi.mocked(deps.reply).mock.lastCall?.[1]).toContain('/status')
  })

  it('replies "not supported" to text when no handler is registered', async () => {
    const { router, deps } = makeRouter()
    await router.route(message(ALLOWED, 'yes'))
    expect(deps.reply).toHaveBeenLastCalledWith(ALLOWED, 'Replies are not supported yet.', 5)
  })

  it('dispatches a reply-to-notice with its route and /to with the worktree query', async () => {
    const handleText = vi.fn(async () => ({ ok: true as const, ack: 'sent <ok>' }))
    const { router, deps, routes } = makeRouter({ handleText })
    const route = routes.register({ paneKey: 'p1' })
    routes.bindMessage(ALLOWED, 3, route.routeId)
    await router.route(message(ALLOWED, 'go ahead', 3))
    expect(handleText).toHaveBeenLastCalledWith({
      chatId: ALLOWED,
      messageId: 5,
      text: 'go ahead',
      route
    })
    expect(deps.reply).toHaveBeenLastCalledWith(ALLOWED, 'sent &lt;ok&gt;', 5)
    await router.route(message(ALLOWED, '/to api deploy'))
    expect(handleText).toHaveBeenLastCalledWith({
      chatId: ALLOWED,
      messageId: 5,
      text: 'deploy',
      worktreeQuery: 'api'
    })
  })

  it('reports a handler failure back to the chat', async () => {
    const { router, deps } = makeRouter({ handleText: async () => ({ ok: false, error: 'stale' }) })
    await router.route(message(ALLOWED, 'x'))
    expect(deps.reply).toHaveBeenLastCalledWith(ALLOWED, 'stale', 5)
  })

  it('routes callbacks from allowed chats and drops strangers silently', async () => {
    const handleCallback = vi.fn(async () => ({ ok: true as const, ack: 'done' }))
    const { router, deps, routes } = makeRouter({ handleCallback })
    const route = routes.register({ paneKey: 'p1' })
    await router.route({
      updateId: 2,
      callbackQuery: { id: 'q', data: `${route.routeId}:yes`, chatId: STRANGER, messageId: 8 }
    })
    expect(deps.answerCallback).not.toHaveBeenCalled()
    await router.route({
      updateId: 3,
      callbackQuery: { id: 'q', data: `${route.routeId}:yes`, chatId: ALLOWED, messageId: 8 }
    })
    expect(handleCallback).toHaveBeenCalledWith({
      chatId: ALLOWED,
      messageId: 8,
      callbackQueryId: 'q',
      route,
      action: 'yes'
    })
    expect(deps.answerCallback).toHaveBeenLastCalledWith('q', 'done')
    await router.route({
      updateId: 4,
      callbackQuery: { id: 'q2', data: 'Unknown1:yes', chatId: ALLOWED, messageId: 8 }
    })
    expect(deps.answerCallback).toHaveBeenLastCalledWith('q2', 'Replies are not supported yet.')
  })
})
