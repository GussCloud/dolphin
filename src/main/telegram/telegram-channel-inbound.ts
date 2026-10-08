import { resolveTelegramAnswerablePrompt } from './telegram-answerable-prompt'
import type { TelegramChannelGateway } from './telegram-channel-gateway'
import type { TelegramInboundHandler } from './telegram-inbound'
import type { TelegramNoticeFilter } from './telegram-notice-delivery'

type ChannelGatewayReader = Pick<
  TelegramChannelGateway,
  'tryHandleText' | 'tryHandleCallback' | 'isConnected'
>

/**
 * The channel answers first; whatever it declines goes to `fallback` (PR2's terminal path). Chained
 * explicitly because the bridge hands each event to one handler, not down a list.
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
        : { ok: false, error: 'Nenhum agente recebeu a mensagem.' }
    },
    async handleCallback(event) {
      const handled = await gateway.tryHandleCallback(event)
      if (handled) {
        return handled
      }
      return fallback.handleCallback
        ? fallback.handleCallback(event)
        : { ok: false, error: 'Ação não reconhecida.' }
    }
  }
}

/**
 * Drops the hook-based approval notice while the pane's channel is connected, since the channel
 * relays that same prompt with its own Sim/Não notice. Questions stay hook-based: channels do not
 * relay AskUserQuestion.
 */
export function createChannelPermissionNoticeFilter(
  gateway: Pick<TelegramChannelGateway, 'isConnected'>
): TelegramNoticeFilter {
  return (notice, entry) =>
    !(
      notice.kind === 'blocked' &&
      gateway.isConnected(entry.paneKey) &&
      resolveTelegramAnswerablePrompt(entry, () => null)?.kind === 'approval'
    )
}
