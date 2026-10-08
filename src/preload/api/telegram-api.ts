import type { TelegramBridgeState } from '../../shared/telegram-bridge-state'

export type TelegramBridgeApi = {
  getState: () => Promise<TelegramBridgeState>
  setEnabled: (enabled: boolean) => Promise<TelegramBridgeState>
  /** Write-only: the token is never read back over IPC. */
  saveToken: (token: string) => Promise<TelegramBridgeState>
  clearToken: () => Promise<TelegramBridgeState>
  issuePairingCode: () => Promise<TelegramBridgeState>
  removeChat: (chatId: number) => Promise<TelegramBridgeState>
  onChanged: (callback: (state: TelegramBridgeState) => void) => () => void
}
