import { translateMain } from '../i18n/main-i18n'

/** Plain text (the bridge escapes it); 0 attempts means no retry could be typed at all. */
export function claudeConnectionLossExhaustedTelegramText(
  worktreeName: string | null,
  attempts: number
): string {
  const where = worktreeName ? ` (${worktreeName})` : ''
  const text =
    attempts === 0
      ? translateMain(
          'notifications.autoRetryExhausted.telegramNoRetry',
          'Claude lost its API connection{{where}} and Dolphin could not retry automatically. Reply "continue" to resume.',
          { where }
        )
      : translateMain(
          'notifications.autoRetryExhausted.telegram',
          'Claude lost its API connection{{where}} and {{attempts}} automatic retries did not recover it. Reply "continue" to resume.',
          { where, attempts }
        )
  return `⚠️ ${text}`
}
