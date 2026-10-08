/**
 * While a pane's Claude channel is connected it relays approvals with its own Yes/No notice, so the
 * hook-based approval notice keeps its text but loses its approval buttons: two answer paths for
 * one prompt would race. If no relay for that pane shows up soon after, the approval buttons are
 * sent again, so a failed relay (unsupported prompt, send error, stale channel) never leaves the
 * user without a way to answer.
 */
import { escapeTelegramHtml } from './telegram-agent-notice'
import {
  decodeTelegramPromptAction,
  resolveTelegramAnswerablePrompt
} from './telegram-answerable-prompt'
import { telegramChannelMessages } from './telegram-channel-messages'
import type {
  TelegramNoticeButton,
  TelegramNoticeDecorator,
  TelegramPaneRoute
} from './telegram-inbound'

export const CHANNEL_RELAY_GRACE_MS = 15_000

export type ChannelApprovalFallbackDeps = {
  gateway: {
    isConnected(paneKey: string): boolean
    /** When the pane's channel last relayed a permission request, if ever. */
    lastPermissionRelayAt(paneKey: string): number | null
  }
  bridge: {
    sendToAllowedChats(
      text: string,
      opts?: { replyToRoute?: TelegramPaneRoute; buttons?: TelegramNoticeButton[][] }
    ): Promise<void>
    createRoute(paneKey: string): TelegramPaneRoute
  }
  /** The pane's current status row: the fallback only fires while the same prompt is pending. */
  readPaneStatus(paneKey: string): { state: string; interactivePrompt?: string } | null
  now?: () => number
  graceMs?: number
}

function isApprovalButton(button: TelegramNoticeButton): boolean {
  return decodeTelegramPromptAction(button.action)?.kind === 'approval'
}

export function createChannelApprovalButtonStripper(
  deps: ChannelApprovalFallbackDeps
): TelegramNoticeDecorator {
  const now = deps.now ?? Date.now
  const graceMs = deps.graceMs ?? CHANNEL_RELAY_GRACE_MS

  const sendFallbackIfUnrelayed = (
    paneKey: string,
    interactivePrompt: string | undefined,
    strippedAt: number,
    approvalButtons: TelegramNoticeButton[]
  ): void => {
    const relayedAt = deps.gateway.lastPermissionRelayAt(paneKey)
    // Why the window reaches back: the relay and the hook race, either can land first.
    if (relayedAt !== null && relayedAt >= strippedAt - graceMs) {
      return
    }
    const status = deps.readPaneStatus(paneKey)
    if (status?.state !== 'blocked' || status.interactivePrompt !== interactivePrompt) {
      return
    }
    void deps.bridge
      .sendToAllowedChats(telegramChannelMessages.approvalFallback(), {
        replyToRoute: deps.bridge.createRoute(paneKey),
        buttons: [approvalButtons]
      })
      .catch((error: unknown) => console.warn('[telegram-channel] approval fallback failed', error))
  }

  return (notice, entry) => {
    if (
      notice.kind !== 'blocked' ||
      !deps.gateway.isConnected(entry.paneKey) ||
      resolveTelegramAnswerablePrompt(entry, () => null)?.kind !== 'approval'
    ) {
      return notice
    }
    const approvalButtons = notice.buttons.flat().filter(isApprovalButton)
    const buttons = notice.buttons
      .map((row) => row.filter((button) => !isApprovalButton(button)))
      .filter((row) => row.length > 0)
    if (approvalButtons.length > 0) {
      const strippedAt = now()
      const timer = setTimeout(
        () =>
          sendFallbackIfUnrelayed(
            entry.paneKey,
            entry.interactivePrompt,
            strippedAt,
            approvalButtons
          ),
        graceMs
      )
      timer.unref?.()
    }
    return {
      ...notice,
      text: `${notice.text}\n<i>${escapeTelegramHtml(telegramChannelMessages.approveInChannel())}</i>`,
      buttons
    }
  }
}
