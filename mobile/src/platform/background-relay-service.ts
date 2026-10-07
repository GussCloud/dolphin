import { AppState, type AppStateStatus } from 'react-native'
import {
  backgroundRelayRetentionWindowMs,
  getBackgroundRelayRetention,
  setBackgroundRelayRetention,
  subscribeBackgroundRelayRetention
} from '../transport/background-relay-retention'
import { loadBackgroundRelayRetention } from '../storage/preferences'
import { nativeBackgroundRelay, type NativeBackgroundRelay } from './native-background-relay'
import { platformCatalog } from '../i18n/catalogs/platform'
import { translate } from '../i18n/mobile-locale-state'

const NOTIFICATION_TITLE = 'Dolphin'

type AppStateSource = {
  currentState: AppStateStatus
  addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void }
}

// Keeps the Android foreground service in step with the retention choice. The service
// starts while visible (Android 12+ refuses background starts) and ends itself when
// the background window lapses; the transport's own timer releases the Relay then.
export function startBackgroundRelayService(
  native: NativeBackgroundRelay | null = nativeBackgroundRelay,
  appState: AppStateSource = AppState
): () => void {
  if (!native) {
    return () => {}
  }
  const syncForeground = (): void => {
    if (getBackgroundRelayRetention() === 'off') {
      native.stop()
      return
    }
    if (appState.currentState !== 'active') {
      return
    }
    if (!native.isRunning()) {
      native.start(NOTIFICATION_TITLE, translate(platformCatalog, 'backgroundRelayNotification'))
    }
    native.enterForeground()
  }
  const onAppState = (state: AppStateStatus): void => {
    const retention = getBackgroundRelayRetention()
    if (state === 'active') {
      syncForeground()
    } else if (state === 'background' && retention !== 'off') {
      native.enterBackground(backgroundRelayRetentionWindowMs(retention))
    }
  }
  const appStateSubscription = appState.addEventListener('change', onAppState)
  const unsubscribeRetention = subscribeBackgroundRelayRetention(syncForeground)
  void loadBackgroundRelayRetention().then(setBackgroundRelayRetention)
  syncForeground()
  return () => {
    appStateSubscription.remove()
    unsubscribeRetention()
  }
}
