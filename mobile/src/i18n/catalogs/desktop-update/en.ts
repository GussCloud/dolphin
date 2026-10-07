import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const desktopUpdateEn = {
  // Host card tag
  tagAvailable: 'Update available',
  tagReady: 'Update ready',
  tagManual: 'Update available · Install on desktop',
  tagStarting: 'Starting update…',
  tagDownloading: 'Downloading {percent}%',
  tagInstalling: 'Restarting desktop…',
  tagFailed: 'Update failed · Retry',
  // Install confirmation
  confirmInstallVersion:
    'Install Dolphin {version} on "{hostName}"? Dolphin will restart on that desktop.',
  confirmInstallLatest:
    'Install the latest Dolphin on "{hostName}"? Dolphin will restart on that desktop.',
  confirmLastAttemptFailed: 'Last attempt failed: {message}',
  // Errors
  errorRestartedOnOlder:
    'The desktop restarted on {installedVersion}; {targetVersion} was not installed.',
  errorManualRequired: 'This desktop must be updated manually.',
  errorNotAvailable: 'The desktop no longer reports an available update.',
  errorNotDownloaded: 'The update has not finished downloading on the desktop.',
  errorUpdaterTimeout: 'Timed out waiting for the desktop updater.'
} as const satisfies MobileCatalogSource
