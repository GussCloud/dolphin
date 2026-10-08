import { escapeTelegramHtml } from './telegram-agent-notice'
import {
  decodeTelegramPromptAction,
  resolveTelegramAnswerablePrompt
} from './telegram-answerable-prompt'
import type { TelegramChannelGateway } from './telegram-channel-gateway'
import { telegramChannelMessages } from './telegram-channel-messages'
import type { TelegramInboundHandler, TelegramNoticeDecorator } from './telegram-inbound'

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

/**
 * While the pane's channel is connected, the channel relays approvals with its own Sim/Não notice,
 * so the hook-based approval notice keeps its text but loses its approval buttons: two answer paths
 * for one prompt would race. The notice itself stays because the relay can fail (unsupported
 * prompt, send error, stale connection). Must run after the answer-button decorator.
 */
export function createChannelApprovalButtonStripper(
  gateway: Pick<TelegramChannelGateway, 'isConnected'>
): TelegramNoticeDecorator {
  return (notice, entry) => {
    if (
      notice.kind !== 'blocked' ||
      !gateway.isConnected(entry.paneKey) ||
      resolveTelegramAnswerablePrompt(entry, () => null)?.kind !== 'approval'
    ) {
      return notice
    }
    const buttons = notice.buttons
      .map((row) =>
        row.filter((button) => decodeTelegramPromptAction(button.action)?.kind !== 'approval')
      )
      .filter((row) => row.length > 0)
    return {
      ...notice,
      text: `${notice.text}\n<i>${escapeTelegramHtml(telegramChannelMessages.approveInChannel())}</i>`,
      buttons
    }
  }
}
