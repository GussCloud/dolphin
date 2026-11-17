// Adapters from the device-code relay's ports onto the Telegram bridge and the mobile runtime.
import type { TelegramConnectionState } from '../../shared/telegram-bridge-state'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { editTelegramMessages, sendTelegramToChats } from '../telegram/telegram-notice-delivery'
import type {
  AzureCliDeviceCodeMobilePort,
  AzureCliDeviceCodeTelegramPort
} from './azure-cli-device-code-relay'

// Why: a network or conflict blip is transient against a 15-minute code; a bad token or no session is not.
const TELEGRAM_DELIVERABLE_STATES: ReadonlySet<TelegramConnectionState> = new Set([
  'ok',
  'connecting',
  'network-error',
  'conflict'
])

const NEW_CODE_ACTION = 'new-code'

export function createTelegramDeviceCodePort(
  bridge: Pick<
    TelegramBridgeService,
    'getConnectionStatus' | 'settings' | 'runInOutbox' | 'createActionRoute'
  >
): { port: AzureCliDeviceCodeTelegramPort; dispose: () => void } {
  const liveRoutes = new Set<() => void>()
  const port: AzureCliDeviceCodeTelegramPort = {
    canDeliver: () =>
      TELEGRAM_DELIVERABLE_STATES.has(bridge.getConnectionStatus().state) &&
      bridge.settings.getAllowedChatIds().length > 0,
    send: (html) => bridge.runInOutbox([], (deps) => sendTelegramToChats(deps, html, {})),
    edit: (messages, html) =>
      bridge.runInOutbox(undefined, (deps) => editTelegramMessages(deps, messages, html)),
    offerButton: (messages, html, button) => {
      const action = bridge.createActionRoute({
        handleCallback: async () => ({ ok: true, ack: button.onTap() })
      })
      const release = (): void => {
        liveRoutes.delete(release)
        action.dispose()
      }
      liveRoutes.add(release)
      const edited = bridge.runInOutbox(undefined, (deps) =>
        editTelegramMessages(deps, messages, html, {
          route: action.route,
          buttons: [[{ label: button.label, action: NEW_CODE_ACTION }]]
        })
      )
      return { edited, release }
    }
  }
  return {
    port,
    dispose: () => {
      for (const release of liveRoutes) {
        release()
      }
    }
  }
}

export type MobileDeviceCodePortDeps = {
  runtime: Pick<DolphinRuntimeService, 'dispatchMobileNotification' | 'dismissMobileNotification'>
  listDevices: () => readonly { scope: string; pushRegistration?: { expiresAt: number } }[]
  now?: () => number
}

export function createMobileDeviceCodePort(
  deps: MobileDeviceCodePortDeps
): AzureCliDeviceCodeMobilePort {
  const now = deps.now ?? Date.now
  return {
    // Why push registrations only: notification-stream subscribers include desktop clients, and
    // the stream cannot tell them from phones.
    canDeliver: () =>
      deps
        .listDevices()
        .some(
          (device) =>
            device.scope === 'mobile' &&
            device.pushRegistration !== undefined &&
            device.pushRegistration.expiresAt > now()
        ),
    notify: ({ notificationId, title, body }) =>
      deps.runtime.dispatchMobileNotification({
        type: 'notification',
        // Why: 'plugin' is a push source phones already accept, so no mobile release is needed.
        source: 'plugin',
        title,
        body,
        notificationId
      }),
    dismiss: (notificationId) => deps.runtime.dismissMobileNotification(notificationId)
  }
}
