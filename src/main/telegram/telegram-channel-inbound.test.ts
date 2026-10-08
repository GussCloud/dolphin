import { describe, expect, it, vi } from 'vitest'
import { chainTelegramChannelInbound } from './telegram-channel-inbound'

const route = { routeId: 'abc123', paneKey: 'tab-1:leaf-1' }

describe('chainTelegramChannelInbound', () => {
  it('lets the channel answer first and falls back when it declines', async () => {
    const gateway = {
      tryHandleText: vi.fn(async (event: { text: string }) =>
        event.text === 'channel' ? { ok: true as const, ack: 'Sent to Claude.' } : null
      ),
      tryHandleCallback: vi.fn(async () => null),
      isConnected: () => true
    }
    const fallback = {
      handleText: vi.fn(async () => ({ ok: true as const, ack: 'resposta enviada' })),
      handleCallback: vi.fn(async () => ({ ok: false as const, error: 'pergunta já respondida' }))
    }
    const handler = chainTelegramChannelInbound(gateway, fallback)
    await expect(
      handler.handleText!({ chatId: 1, messageId: 2, text: 'channel' })
    ).resolves.toEqual({ ok: true, ack: 'Sent to Claude.' })
    expect(fallback.handleText).not.toHaveBeenCalled()
    await expect(
      handler.handleText!({ chatId: 1, messageId: 2, text: 'terminal' })
    ).resolves.toEqual({ ok: true, ack: 'resposta enviada' })
    await expect(
      handler.handleCallback!({ chatId: 1, messageId: 2, callbackQueryId: 'q', route, action: 'x' })
    ).resolves.toEqual({ ok: false, error: 'pergunta já respondida' })
  })
})
