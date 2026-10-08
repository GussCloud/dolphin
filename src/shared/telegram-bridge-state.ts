// What the settings UI sees of the Telegram bridge. The bot token never crosses IPC.

export type TelegramConnectionState =
  | 'disabled'
  | 'not-configured'
  | 'connecting'
  | 'ok'
  | 'conflict'
  | 'invalid-token'
  | 'network-error'

export type TelegramConnectionStatus = {
  state: TelegramConnectionState
  botUsername?: string
  detail?: string
}

/** Whether this host can open Claude panes on the channel; `off` while the setting is off. */
export type TelegramChannelAvailability =
  | 'off'
  | 'checking'
  | 'ready'
  | 'claude-not-found'
  | 'claude-too-old'
  | 'config-unavailable'

export type TelegramAllowedChatView = { chatId: number; label: string; pairedAt: number }

export type TelegramBridgeState = {
  /** False on hosts that never start the bridge. */
  available: boolean
  enabled: boolean
  /** Experimental Claude channel delivery; off by default. */
  channelsEnabled: boolean
  /** Absent from hosts without the channel. */
  channelAvailability?: TelegramChannelAvailability
  tokenConfigured: boolean
  allowedChats: TelegramAllowedChatView[]
  pairingCode: { code: string; expiresAt: number } | null
  protectionGap: string | null
  connection: TelegramConnectionStatus
}

export const TELEGRAM_BRIDGE_CHANGED_CHANNEL = 'telegram:changed'

/** Guards IPC results: a fallback API (web client, tests) can resolve undefined. */
export function isTelegramBridgeState(value: unknown): value is TelegramBridgeState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'available' in value &&
    typeof value.available === 'boolean' &&
    'connection' in value &&
    typeof value.connection === 'object' &&
    value.connection !== null &&
    'allowedChats' in value &&
    Array.isArray(value.allowedChats)
  )
}
