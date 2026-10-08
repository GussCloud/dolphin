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
    createRoute: (paneKey: string): TelegramPaneRoute => ({ routeId: 'route1', paneKey }),
    resolveWorktreeQuery: (query: string) =>
      query === 'both'
        ? [{ worktreeId: 'wt', paneKeys: [PANE_A, PANE_B] }]
        : query === 'a'
          ? [{ worktreeId: 'wt-a', paneKeys: [PANE_A] }]
          : []
  }
}

type PollResult = { status: number; json?: unknown }

function poll(
  gateway: TelegramChannelGateway,
  paneKey: string,
  sessionId: string,
  ack = 0,
  signal: AbortSignal = new AbortController().signal
): Promise<PollResult> {
  return gateway.handleRoute({
    pathname: '/channel/poll',
    body: { paneKey, sessionId, ack },
    signal
  })
}

function events(result: PollResult): unknown[] {
  const json = result.json
  if (!json || typeof json !== 'object' || !('events' in json) || !Array.isArray(json.events)) {
    throw new Error(`poll answered ${result.status} without events`)
  }
  return json.events
}

function textEvent(text: string, extra: Record<string, unknown> = {}) {
  return { chatId: 7, messageId: 11, text, ...extra }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TelegramChannelGateway delivery', () => {
  it('reports "sent" only after the next poll acknowledges the text', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    const held = poll(gateway, PANE_A, 's1')
    let settled = false
    const handled = gateway.tryHandleText(textEvent('roda os testes')).then((result) => {
      settled = true
      return result
    })
    const first = await held
    expect(events(first)).toEqual([
      { seq: 1, kind: 'message', text: 'roda os testes', meta: { chat_id: '7', message_id: '11' } }
    ])
    await Promise.resolve()
    expect(settled).toBe(false)
    void poll(gateway, PANE_A, 's1', 1)
    await expect(handled).resolves.toEqual({ ok: true, ack: 'Sent to Claude.' })
    gateway.dispose()
  })

  it('resends unacknowledged events, so a lost response loses nothing', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    const held = poll(gateway, PANE_A, 's1')
    void gateway.tryHandleText(textEvent('um'))
    expect(events(await held)).toMatchObject([{ seq: 1 }])
    // The response above never reached the server: it polls again still acking 0.
    expect(events(await poll(gateway, PANE_A, 's1', 0))).toMatchObject([{ seq: 1 }])
    gateway.dispose()
  })

  it('falls back when no channel takes the text, and says so when it went unconfirmed', async () => {
    vi.useFakeTimers()
    const gateway = new TelegramChannelGateway(createBridge(), { deliveryTimeoutMs: 1_000 })
    await expect(gateway.tryHandleText(textEvent('oi'))).resolves.toBeNull()
    const held = poll(gateway, PANE_A, 's1')
    const handled = gateway.tryHandleText(textEvent('perdido?'))
    await held
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(handled).resolves.toEqual({
      ok: false,
      error: 'Claude did not confirm it received the message; check the terminal.'
    })
    gateway.dispose()
  })

  it('treats a pane with no poll for 30s, or a dropped poll, as disconnected', async () => {
    vi.useFakeTimers()
    let now = 1_000
    const gateway = new TelegramChannelGateway(createBridge(), {
      now: () => now,
      pollHoldMs: 1_000
    })
    const held = poll(gateway, PANE_A, 's1')
    await vi.advanceTimersByTimeAsync(1_000)
    await held
    expect(gateway.isConnected(PANE_A)).toBe(true)
    now += 30_001
    expect(gateway.isConnected(PANE_A)).toBe(false)
    await expect(gateway.tryHandleText(textEvent('x'))).resolves.toBeNull()

    const abort = new AbortController()
    const dropped = poll(gateway, PANE_A, 's1', 0, abort.signal)
    expect(gateway.isConnected(PANE_A)).toBe(true)
    abort.abort()
    await dropped
    expect(gateway.isConnected(PANE_A)).toBe(false)
  })

  it('lets a relaunched session supersede the old one', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    const old = poll(gateway, PANE_A, 'old')
    const fresh = poll(gateway, PANE_A, 'new')
    await expect(old).resolves.toEqual({ status: 409 })
    await expect(poll(gateway, PANE_A, 'old')).resolves.toEqual({ status: 409 })
    void gateway.tryHandleText(textEvent('x'))
    await expect(fresh).resolves.toMatchObject({ status: 200 })
    gateway.dispose()
  })
})

describe('TelegramChannelGateway routing', () => {
  it('routes by notice reply, /to query, or the only connected pane', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    void poll(gateway, PANE_A, 'sa')
    void gateway.tryHandleText(textEvent('x', { worktreeQuery: 'a' }))
    void poll(gateway, PANE_B, 'sb')
    await expect(gateway.tryHandleText(textEvent('ambos'))).resolves.toEqual({
      ok: false,
      error:
        'More than one Claude is connected. Reply to the message of the Claude that should get this.'
    })
    await expect(
      gateway.tryHandleText(textEvent('x', { worktreeQuery: 'both' }))
    ).resolves.toMatchObject({ ok: false })
    await expect(
      gateway.tryHandleText(textEvent('x', { worktreeQuery: 'none' }))
    ).resolves.toBeNull()
    await expect(
      gateway.tryHandleText(textEvent('x', { route: { routeId: 'r', paneKey: 'tab-z:leaf-z' } }))
    ).resolves.toBeNull()
    gateway.dispose()
  })

  it('asks for a notice reply when other agents are waiting on the user', async () => {
    const attention = vi.fn(() => [PANE_A, 'tab-codex:leaf'])
    const gateway = new TelegramChannelGateway(createBridge(), { attentionPaneKeys: attention })
    void poll(gateway, PANE_A, 'sa')
    await expect(gateway.tryHandleText(textEvent('bare'))).resolves.toEqual({
      ok: false,
      error: 'Several agents need you. Reply to the notice of the one this is for.'
    })
    attention.mockReturnValue([PANE_A])
    const delivered = gateway.tryHandleText(textEvent('bare'))
    void poll(gateway, PANE_A, 'sa', 1)
    await expect(delivered).resolves.toMatchObject({ ok: true })
    gateway.dispose()
  })

  it('rejects malformed channel requests and unknown paths', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    const signal = new AbortController().signal
    await expect(
      gateway.handleRoute({ pathname: '/channel/poll', body: {}, signal })
    ).resolves.toEqual({ status: 400 })
    await expect(
      gateway.handleRoute({ pathname: '/channel/nope', body: {}, signal })
    ).resolves.toEqual({ status: 404 })
  })
})

describe('TelegramChannelGateway replies and permission relay', () => {
  it('forwards replies as plain text with a reply route', async () => {
    const bridge = createBridge()
    const gateway = new TelegramChannelGateway(bridge)
    void poll(gateway, PANE_A, 's1')
    const signal = new AbortController().signal
    await expect(
      gateway.handleRoute({
        pathname: '/channel/reply',
        body: { paneKey: PANE_A, sessionId: 's1', text: 'a < b & c' },
        signal
      })
    ).resolves.toEqual({ status: 200, json: { ok: true } })
    expect(bridge.sendToAllowedChats).toHaveBeenCalledWith('a < b & c', {
      replyToRoute: { routeId: 'route1', paneKey: PANE_A }
    })
    await expect(
      gateway.handleRoute({
        pathname: '/channel/reply',
        body: { paneKey: PANE_A, sessionId: 'other', text: 'x' },
        signal
      })
    ).resolves.toEqual({ status: 409 })
    gateway.dispose()
  })

  async function requestPermission(
    gateway: TelegramChannelGateway,
    requestId: string
  ): Promise<void> {
    await gateway.handleRoute({
      pathname: '/channel/permission-request',
      body: {
        paneKey: PANE_A,
        sessionId: 's1',
        requestId,
        toolName: 'Bash',
        description: 'Run tests',
        inputPreview: '{"command":"pnpm test"}'
      },
      signal: new AbortController().signal
    })
  }

  it('sends a Yes/No notice and routes the button verdict back through the channel', async () => {
    const bridge = createBridge()
    const gateway = new TelegramChannelGateway(bridge)
    const held = poll(gateway, PANE_A, 's1')
    await requestPermission(gateway, 'abcde')
    const [text, opts] = bridge.sendToAllowedChats.mock.calls[0]
    expect(text).toContain('Claude asks permission: Bash')
    expect(text).toContain('{"command":"pnpm test"}')
    expect(text).toContain('"yes abcde"')
    expect(opts.buttons).toEqual([
      [
        { label: 'Yes', action: 'chp-allow-abcde' },
        { label: 'No', action: 'chp-deny-abcde' }
      ]
    ])
    const route = { routeId: 'r1', paneKey: PANE_A }
    const callback = { chatId: 7, messageId: 3, callbackQueryId: 'q', route }
    await expect(gateway.tryHandleCallback({ ...callback, action: 'other' })).resolves.toBeNull()
    await expect(
      gateway.tryHandleCallback({ ...callback, action: 'chp-allow-abcde' })
    ).resolves.toEqual({ ok: true, ack: 'Allowed.' })
    expect(events(await held)).toEqual([
      { seq: 1, kind: 'permission-verdict', requestId: 'abcde', behavior: 'allow' }
    ])
    await expect(
      gateway.tryHandleCallback({ ...callback, action: 'chp-deny-abcde' })
    ).resolves.toMatchObject({ ok: false })
    gateway.dispose()
  })

  it('accepts typed verdicts in several languages', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    void poll(gateway, PANE_A, 's1')
    for (const [reply, ack] of [
      ['Não qwert', 'Denied.'],
      ['sí qwert', 'Allowed.'],
      ['はい qwert', 'Allowed.']
    ]) {
      await requestPermission(gateway, 'qwert')
      await expect(gateway.tryHandleText(textEvent(reply))).resolves.toEqual({ ok: true, ack })
    }
    gateway.dispose()
  })

  it('takes verdicts only from a private chat, never from a group', async () => {
    const gateway = new TelegramChannelGateway(createBridge())
    void poll(gateway, PANE_A, 's1')
    await requestPermission(gateway, 'abcde')
    const route = { routeId: 'r1', paneKey: PANE_A }
    await expect(
      gateway.tryHandleCallback({
        chatId: -100123,
        messageId: 3,
        callbackQueryId: 'q',
        route,
        action: 'chp-allow-abcde'
      })
    ).resolves.toEqual({
      ok: false,
      error: 'Permission requests can only be answered from your private chat with the bot.'
    })
    await expect(
      gateway.tryHandleText({ chatId: -5, messageId: 1, text: 'yes abcde' })
    ).resolves.toMatchObject({ ok: false })
    gateway.dispose()
  })
})
