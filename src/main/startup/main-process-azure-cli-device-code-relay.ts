import { hostname } from 'node:os'
import type { AzureCliSignInState } from '../../shared/azure-devops-auth'
import {
  cancelAzureCliSignIn,
  startAzureCliSignIn
} from '../azure-devops/azure-cli-interactive-sign-in'
import {
  shutdownAzureCliDeviceCodeRelay,
  startAzureCliDeviceCodeRelay
} from '../azure-devops/azure-cli-device-code-relay'
import {
  createMobileDeviceCodePort,
  createTelegramDeviceCodePort
} from '../azure-devops/azure-cli-device-code-relay-channels'
import {
  getAzureCliSignInState,
  isAzureCliSignInNoticeEnabled,
  onAzureCliSessionRenewed,
  onAzureCliSignInStateChanged
} from '../azure-devops/azure-cli-sign-in-notice'
import { getMainSystemLocale } from '../i18n/main-i18n'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { mainProcessState as state } from './main-process-state'

// Why 1.5s: enough for one Telegram edit round trip; a quit must not wait on a slow network.
const QUIT_EDIT_BUDGET_MS = 1_500

/** A "New code" tap signs in only while the notice is on and the session still needs it. */
export function azureCliNewCodeDecision(
  enabled: boolean,
  signIn: AzureCliSignInState
): 'start' | 'in-progress' | 'not-needed' {
  if (!enabled) {
    return 'not-needed'
  }
  if (signIn.kind === 'signing-in') {
    return 'in-progress'
  }
  return signIn.kind === 'required' || signIn.kind === 'failed' ? 'start' : 'not-needed'
}

/** Sends device-code `az login` prompts to Telegram and paired phones; resolves once shut down. */
export function startMainProcessAzureCliDeviceCodeRelay(
  runtime: DolphinRuntimeService,
  bridge: TelegramBridgeService | null
): { shutdown: () => Promise<void> } {
  const telegram = bridge ? createTelegramDeviceCodePort(bridge) : null
  const mobile = createMobileDeviceCodePort({
    runtime,
    // Why: read at probe time; the RPC server comes up after plugins start.
    listDevices: () => state.runtimeRpc?.getDeviceRegistry()?.listDevices() ?? []
  })
  const relay = startAzureCliDeviceCodeRelay({
    telegram: telegram?.port ?? null,
    mobile,
    hostName: hostname(),
    requestNewCode: () => {
      const decision = azureCliNewCodeDecision(
        isAzureCliSignInNoticeEnabled(),
        getAzureCliSignInState()
      )
      if (decision !== 'start') {
        return decision
      }
      void startAzureCliSignIn('device-code').catch((error: unknown) =>
        console.warn('[azure-devops] device-code retry failed', error)
      )
      return 'started'
    },
    subscribeSessionSettled: (listener) => {
      const disposeRenewed = onAzureCliSessionRenewed(listener)
      const disposeState = onAzureCliSignInStateChanged((next) => {
        if (next.kind === 'idle') {
          listener()
        }
      })
      return () => {
        disposeRenewed()
        disposeState()
      }
    },
    subscribeSignInFailed: (listener) =>
      onAzureCliSignInStateChanged((next) => {
        if (next.kind === 'failed') {
          listener()
        }
      }),
    formatTime: (epochMs) =>
      new Date(epochMs).toLocaleTimeString(getMainSystemLocale(), {
        hour: '2-digit',
        minute: '2-digit'
      })
  })
  let shutdown: Promise<void> | null = null
  return {
    shutdown: () => {
      shutdown ??= shutdownAzureCliDeviceCodeRelay(
        relay,
        cancelAzureCliSignIn,
        QUIT_EDIT_BUDGET_MS
      ).finally(() => telegram?.dispose())
      return shutdown
    }
  }
}
