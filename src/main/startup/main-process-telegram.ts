import { app } from 'electron'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import { agentHookServer } from '../agent-hooks/server'
import type { Store } from '../persistence'
import { resolveWorkspaceDisplayName } from '../workspace-display-name'
import { subscribeTelegramBridgeBroadcasts } from '../ipc/telegram-bridge'
import { setTelegramBridge, TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { TelegramSettingsStore } from '../telegram/telegram-settings'

const TELEGRAM_SETTINGS_FILE = 'telegram-bridge.json'

/** Starts the bridge beside the plugin status tap; it stays idle until enabled with a token. */
export function startMainProcessTelegramBridge(store: Store): TelegramBridgeService {
  const settings = new TelegramSettingsStore({
    filePath: join(app.getPath('userData'), TELEGRAM_SETTINGS_FILE),
    secretStore: getSecretStore()
  })
  const bridge = new TelegramBridgeService({
    statusSource: agentHookServer,
    settings,
    resolveWorktreeName: (worktreeId) => resolveWorkspaceDisplayName(store, worktreeId)
  })
  setTelegramBridge(bridge)
  subscribeTelegramBridgeBroadcasts()
  bridge.start()
  app.once('will-quit', () => bridge.dispose())
  return bridge
}
