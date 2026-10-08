import { BrowserWindow, ipcMain } from 'electron'
import {
  TELEGRAM_BRIDGE_CHANGED_CHANNEL,
  type TelegramBridgeState
} from '../../shared/telegram-bridge-state'
import { getTelegramBridge, type TelegramBridgeService } from '../telegram/telegram-bridge-service'

const UNAVAILABLE_STATE: TelegramBridgeState = {
  available: false,
  enabled: false,
  tokenConfigured: false,
  allowedChats: [],
  pairingCode: null,
  protectionGap: null,
  connection: { state: 'disabled' }
}

export function readTelegramBridgeState(bridge: TelegramBridgeService | null): TelegramBridgeState {
  if (!bridge) {
    return UNAVAILABLE_STATE
  }
  const snapshot = bridge.settings.getSnapshot()
  return {
    available: true,
    enabled: snapshot.enabled,
    tokenConfigured: snapshot.tokenConfigured,
    allowedChats: snapshot.allowedChats,
    pairingCode: bridge.settings.getPairingCode(),
    protectionGap: snapshot.protectionGap,
    connection: bridge.getConnectionStatus()
  }
}

function requireBridge(): TelegramBridgeService {
  const bridge = getTelegramBridge()
  if (!bridge) {
    throw new Error('Telegram bridge is not running on this host')
  }
  return bridge
}

function broadcastTelegramBridgeState(): void {
  const state = readTelegramBridgeState(getTelegramBridge())
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(TELEGRAM_BRIDGE_CHANGED_CHANNEL, state)
    }
  }
}

let subscribedBridge: TelegramBridgeService | null = null

export function subscribeTelegramBridgeBroadcasts(): void {
  const bridge = getTelegramBridge()
  if (!bridge || bridge === subscribedBridge) {
    return
  }
  subscribedBridge = bridge
  bridge.onConnectionStatus(() => broadcastTelegramBridgeState())
  bridge.settings.onChange(() => broadcastTelegramBridgeState())
}

/** Runs a mutation and answers with the resulting state; arguments arrive untyped over IPC. */
function mutate(apply: (bridge: TelegramBridgeService) => void): TelegramBridgeState {
  subscribeTelegramBridgeBroadcasts()
  const bridge = requireBridge()
  apply(bridge)
  return readTelegramBridgeState(bridge)
}

export function registerTelegramBridgeHandlers(): void {
  ipcMain.handle('telegram:getState', () => {
    subscribeTelegramBridgeBroadcasts()
    return readTelegramBridgeState(getTelegramBridge())
  })
  ipcMain.handle('telegram:setEnabled', (_event, enabled: unknown) =>
    mutate((bridge) => {
      if (typeof enabled !== 'boolean') {
        throw new Error('enabled must be a boolean')
      }
      bridge.settings.setEnabled(enabled)
    })
  )
  ipcMain.handle('telegram:saveToken', (_event, token: unknown) =>
    mutate((bridge) => {
      if (typeof token !== 'string') {
        throw new Error('Telegram bot token must be a string')
      }
      bridge.settings.setToken(token)
    })
  )
  ipcMain.handle('telegram:clearToken', () => mutate((bridge) => bridge.settings.clearToken()))
  ipcMain.handle('telegram:issuePairingCode', () =>
    mutate((bridge) => {
      bridge.settings.issuePairingCode()
    })
  )
  ipcMain.handle('telegram:removeChat', (_event, chatId: unknown) =>
    mutate((bridge) => {
      if (typeof chatId !== 'number' || !Number.isSafeInteger(chatId)) {
        throw new Error('chatId must be an integer')
      }
      bridge.settings.removeAllowedChat(chatId)
    })
  )
}
