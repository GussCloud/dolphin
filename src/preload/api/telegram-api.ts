import type { TelegramBridgeState } from '../../shared/telegram-bridge-state'

export type TelegramBridgeApi = {
  getState: () => Promise<TelegramBridgeState>
  setEnabled: (enabled: boolean) => Promise<TelegramBridgeState>
  setChannelsEnabled: (enabled: boolean) => Promise<TelegramBridgeState>
  /** Write-only: the token is never read back over IPC. */
  saveToken: (token: string) => Promise<TelegramBridgeState>
  clearToken: () => Promise<TelegramBridgeState>
  issuePairingCode: () => Promise<TelegramBridgeState>
  removeChat: (chatId: number) => Promise<TelegramBridgeState>
  /** Whether main launched this PTY with the Claude channel flags (its startup dialog may show). */
  isClaudeChannelPty: (ptyId: string) => Promise<boolean>
  onChanged: (callback: (state: TelegramBridgeState) => void) => () => void
}
