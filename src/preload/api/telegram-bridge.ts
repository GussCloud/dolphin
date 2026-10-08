import { ipcRenderer } from 'electron'
import {
  TELEGRAM_BRIDGE_CHANGED_CHANNEL,
  type TelegramBridgeState
} from '../../shared/telegram-bridge-state'
import type { PreloadApi } from '../api-types'

export const telegramBridgeApi = {
  getState: () => ipcRenderer.invoke('telegram:getState'),
  setEnabled: (enabled) => ipcRenderer.invoke('telegram:setEnabled', enabled),
  saveToken: (token) => ipcRenderer.invoke('telegram:saveToken', token),
  clearToken: () => ipcRenderer.invoke('telegram:clearToken'),
  issuePairingCode: () => ipcRenderer.invoke('telegram:issuePairingCode'),
  removeChat: (chatId) => ipcRenderer.invoke('telegram:removeChat', chatId),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: TelegramBridgeState): void =>
      callback(state)
    ipcRenderer.on(TELEGRAM_BRIDGE_CHANGED_CHANNEL, listener)
    return () => ipcRenderer.removeListener(TELEGRAM_BRIDGE_CHANGED_CHANNEL, listener)
  }
} satisfies PreloadApi['telegram']
