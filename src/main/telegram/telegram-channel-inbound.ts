import type { TelegramChannelGateway } from './telegram-channel-gateway'
import { telegramChannelMessages } from './telegram-channel-messages'
import type { TelegramInboundHandler } from './telegram-inbound'

type ChannelGatewayReader = Pick<
  TelegramChannelGateway,
  'tryHandleText' | 'tryHandleCallback' | 'isConnected'
>

/**
 * The channel answers first; whatever it declines goes to `fallback` (the terminal answer path).
 * Chained explicitly because the bridge hands each event to one handler, not down a list.
 */
export function chainTelegramChannelInbound(
  gateway: ChannelGatewayReader,
  fallback: TelegramInboundHandler
): TelegramInboundHandler {
  return {
    async handleText(event) {
      const handled = await gateway.tryHandleText(event)
      if (handled) {
        return handled
      }
      return fallback.handleText
        ? fallback.handleText(event)
        : { ok: false, error: telegramChannelMessages.noAgent() }
    },
    async handleCallback(event) {
      const handled = await gateway.tryHandleCallback(event)
      if (handled) {
        return handled
      }
      return fallback.handleCallback
        ? fallback.handleCallback(event)
        : { ok: false, error: telegramChannelMessages.unknownAction() }
    }
  }
}
