import { afterEach, describe, expect, it, vi } from 'vitest'
import { TelegramChannelGateway, type TelegramChannelBridgePort } from './telegram-channel-gateway'
import type { TelegramPaneRoute } from './telegram-inbound'

const PANE_A = 'tab-a:leaf-a'
const PANE_B = 'tab-b:leaf-b'

function createBridge(): TelegramChannelBridgePort & {
  sendToAllowedChats: ReturnType<typeof vi.fn>
} {
  return {
    sendToAllowedChats: vi.fn(async () => {}),
    createRoute: (paneKey: string): TelegramPaneRoute => ({
      routeId: `r${paneKey.length}xyz`,
      paneKey
    }),
    resolveWorktreeQuery: (query: string) =>
      query === 'both'
        ? [{ worktreeId: 'wt', paneKeys: [PANE_A, PANE_B] }]
        : query === 'a'
          ? [{ worktreeId: 'wt-a', paneKeys: [PANE_A] }]
          : []
  }
}

function poll(
  gateway: TelegramChannelGateway,
  paneKey: string,
  sessionId: string,
  signal?: AbortSignal
) {
  return gateway.handleRoute({
    pathname: '/channel/poll',
    body: { paneKey, sessionId },
    signal: signal ?? new AbortController().signal
  })
}

function textEvent(text: string, extra: Record<string, unknown> = {}) {
  return { chatId: 7, messageId: 11, text, ...extra }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TelegramChannelGateway', () => {
  it('releases a held poll with delivered text and reports the pane connected', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    expect(gateway.deliver(PANE_A, 'oi')).toBe(false)
    const pending = poll(gateway, PANE_A, 's1')
    expect(gateway.isConnected(PANE_A)).toBe(true)
    expect(gateway.deliver(PANE_A, 'roda os testes', { chat_id: '7' })).toBe(true)
    await expect(pending).resolves.toEqual({
      status: 200,
      json: { events: [{ kind: 'message', text: 'roda os testes', meta: { chat_id: '7' } }] }
    })
  })

  it('answers an idle poll after the hold and goes stale without polls', async () => {
    vi.useFakeTimers()
    let now = 0
    const gateway = new TelegramChannelGateway(createBridge(), {
      now: () => now,
      pollHoldMs: 1_000
    })
    const pending = poll(gateway, PANE_A, 's1')
    now = 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(pending).resolves.toEqual({ status: 200, json: { events: [] } })
    expect(gateway.isConnected(PANE_A)).toBe(true)
    now = 1_000 + 16_001
    expect(gateway.isConnected(PANE_A)).toBe(false)
  })

  it('lets a relaunched session supersede the old one', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    const old = poll(gateway, PANE_A, 'old')
    const fresh = poll(gateway, PANE_A, 'new')
    await expect(old).resolves.toEqual({ status: 409 })
    await expect(poll(gateway, PANE_A, 'old')).resolves.toEqual({ status: 409 })
    gateway.deliver(PANE_A, 'x')
    await expect(fresh).resolves.toMatchObject({ status: 200 })
  })

  it('forwards replies to the allowed chats as plain text with a reply route', async () => {
    const bridge = createBridge()
    const gateway = new TelegramChannelGateway(bridge)
    void poll(gateway, PANE_A, 's1')
    const result = await gateway.handleRoute({
      pathname: '/channel/reply',
      body: { paneKey: PANE_A, sessionId: 's1', text: 'a < b & c' },
      signal: new AbortController().signal
    })
    expect(result).toEqual({ status: 200, json: { ok: true } })
    expect(bridge.sendToAllowedChats).toHaveBeenCalledWith('a < b & c', {
      replyToRoute: { routeId: `r${PANE_A.length}xyz`, paneKey: PANE_A }
    })
    const stale = await gateway.handleRoute({
      pathname: '/channel/reply',
      body: { paneKey: PANE_A, sessionId: 'other', text: 'x' },
      signal: new AbortController().signal
    })
    expect(stale.status).toBe(409)
    gateway.dispose()
  })

  it('turns a permission request into a Sim/Não notice and routes the button verdict back', async () => {
    const bridge = createBridge()
    const gateway = new TelegramChannelGateway(bridge)
    const held = poll(gateway, PANE_A, 's1')
    await gateway.handleRoute({
      pathname: '/channel/permission-request',
      body: {
        paneKey: PANE_A,
        sessionId: 's1',
        requestId: 'abcde',
        toolName: 'Bash',
        description: 'Run tests',
        inputPreview: '{"command":"pnpm test"}'
      },
      signal: new AbortController().signal
    })
    const [text, opts] = bridge.sendToAllowedChats.mock.calls[0]
    expect(text).toContain('Claude pede permissão: Bash')
    expect(text).toContain('{"command":"pnpm test"}')
    expect(opts.buttons).toEqual([
      [
        { label: 'Sim', action: 'chp-allow-abcde' },
        { label: 'Não', action: 'chp-deny-abcde' }
      ]
    ])
    const route = { routeId: 'r1', paneKey: PANE_A }
    const callback = { chatId: 7, messageId: 3, callbackQueryId: 'q', route }
    await expect(gateway.tryHandleCallback({ ...callback, action: 'other' })).resolves.toBeNull()
    await expect(
      gateway.tryHandleCallback({ ...callback, action: 'chp-allow-abcde' })
    ).resolves.toEqual({ ok: true, ack: 'Permitido.' })
    await expect(held).resolves.toEqual({
      status: 200,
      json: { events: [{ kind: 'permission-verdict', requestId: 'abcde', behavior: 'allow' }] }
    })
    await expect(
      gateway.tryHandleCallback({ ...callback, action: 'chp-deny-abcde' })
    ).resolves.toMatchObject({ ok: false })
    gateway.dispose()
  })

  it('accepts a typed "não <id>" verdict', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    void poll(gateway, PANE_A, 's1')
    await gateway.handleRoute({
      pathname: '/channel/permission-request',
      body: { paneKey: PANE_A, sessionId: 's1', requestId: 'qwert', toolName: 'Write' },
      signal: new AbortController().signal
    })
    await expect(gateway.tryHandleText(textEvent('Não qwert'))).resolves.toEqual({
      ok: true,
      ack: 'Negado.'
    })
    gateway.dispose()
  })

  it('routes text by notice reply, /to query, or the only connected pane, else falls back', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    await expect(gateway.tryHandleText(textEvent('oi'))).resolves.toBeNull()
    const a = poll(gateway, PANE_A, 'sa')
    await expect(gateway.tryHandleText(textEvent('só um'))).resolves.toEqual({
      ok: true,
      ack: 'Enviado ao Claude.'
    })
    await expect(a).resolves.toMatchObject({
      json: { events: [{ text: 'só um', meta: { chat_id: '7', message_id: '11' } }] }
    })
    void poll(gateway, PANE_A, 'sa')
    void poll(gateway, PANE_B, 'sb')
    await expect(gateway.tryHandleText(textEvent('ambos'))).resolves.toMatchObject({ ok: false })
    await expect(
      gateway.tryHandleText(textEvent('x', { worktreeQuery: 'both' }))
    ).resolves.toMatchObject({
      ok: false
    })
    await expect(
      gateway.tryHandleText(textEvent('x', { worktreeQuery: 'a' }))
    ).resolves.toMatchObject({ ok: true })
    await expect(
      gateway.tryHandleText(textEvent('x', { worktreeQuery: 'none' }))
    ).resolves.toBeNull()
    await expect(
      gateway.tryHandleText(textEvent('x', { route: { routeId: 'r', paneKey: 'tab-z:leaf-z' } }))
    ).resolves.toBeNull()
    gateway.dispose()
  })

  it('rejects malformed channel requests and unknown paths', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    const signal = new AbortController().signal
    await expect(
      gateway.handleRoute({ pathname: '/channel/poll', body: {}, signal })
    ).resolves.toEqual({
      status: 400
    })
    await expect(
      gateway.handleRoute({ pathname: '/channel/nope', body: {}, signal })
    ).resolves.toEqual({ status: 404 })
  })
})
