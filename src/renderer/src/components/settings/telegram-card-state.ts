import { translate } from '@/i18n/i18n'
import type { TelegramBridgeState } from '../../../../shared/telegram-bridge-state'
import type { IntegrationCardStatusTone } from './integration-card-shell'

export function telegramStatusLabel(state: TelegramBridgeState | null): string {
  switch (state?.connection.state) {
    case undefined:
      return ''
    case 'disabled':
      return translate('auto.components.settings.telegramIntegrationCard.statusOff', 'Off')
    case 'not-configured':
      return translate(
        'auto.components.settings.telegramIntegrationCard.statusNotConfigured',
        'Not configured'
      )
    case 'connecting':
      return translate(
        'auto.components.settings.telegramIntegrationCard.statusConnecting',
        'Connecting'
      )
    case 'ok':
      return translate('auto.components.settings.telegramIntegrationCard.statusOk', 'Connected')
    case 'conflict':
      return translate(
        'auto.components.settings.telegramIntegrationCard.statusConflict',
        'Another app is polling'
      )
    case 'invalid-token':
      return translate(
        'auto.components.settings.telegramIntegrationCard.statusInvalidToken',
        'Invalid token'
      )
    case 'network-error':
      return translate(
        'auto.components.settings.telegramIntegrationCard.statusNetworkError',
        'Unreachable'
      )
  }
}

export function telegramStatusTone(state: TelegramBridgeState | null): IntegrationCardStatusTone {
  const connection = state?.connection.state
  if (connection === 'ok') {
    return 'connected'
  }
  return connection === 'conflict' ||
    connection === 'invalid-token' ||
    connection === 'network-error'
    ? 'attention'
    : 'neutral'
}

/** Inline explanation for states the user has to act on; null when the pill says enough. */
export function telegramStatusHint(state: TelegramBridgeState | null): string | null {
  switch (state?.connection.state) {
    case 'conflict':
      return translate(
        'auto.components.settings.telegramIntegrationCard.conflictHint',
        'Telegram reports another program reading updates for this bot (HTTP 409). Stop the other poller or webhook; Dolphin retries every 30 seconds.'
      )
    case 'invalid-token':
      return translate(
        'auto.components.settings.telegramIntegrationCard.invalidTokenHint',
        'Telegram rejected the bot token. Paste a new token from @BotFather.'
      )
    case 'network-error':
      return translate(
        'auto.components.settings.telegramIntegrationCard.networkHint',
        'Telegram is unreachable from this computer. Dolphin keeps retrying.'
      )
    case undefined:
    case 'disabled':
    case 'not-configured':
    case 'connecting':
    case 'ok':
      return null
  }
}
