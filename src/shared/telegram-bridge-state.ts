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

export type TelegramAllowedChatView = { chatId: number; label: string; pairedAt: number }

export type TelegramBridgeState = {
  /** False on hosts that never start the bridge. */
  available: boolean
  enabled: boolean
  tokenConfigured: boolean
  allowedChats: TelegramAllowedChatView[]
  pairingCode: { code: string; expiresAt: number } | null
  protectionGap: string | null
  connection: TelegramConnectionStatus
}

export const TELEGRAM_BRIDGE_CHANGED_CHANNEL = 'telegram:changed'
