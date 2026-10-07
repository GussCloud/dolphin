import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const mobileWebShellEn = {
  // Waiting and progress
  opening: 'Opening workspace',
  checkingHost: 'Checking host',
  downloading: 'Downloading workspace',
  downloadProgress: '{completedAssets}/{totalAssets} files · {receivedBytes}/{totalBytes} bytes',
  offline: 'Connect to this host to download the workspace',
  loading: 'Loading',
  // Failures
  failureIsolationUnavailable: "This device's WebView is too old to open the workspace safely.",
  failureDownload: 'The workspace could not be downloaded from this host.',
  failureStatusUnreadable: "Could not read this host's status. Go back and reopen it.",
  failureStoppedResponding: 'The workspace stopped responding.',
  failureCouldNotOpen: 'The downloaded workspace could not be opened.',
  tryAgain: 'Try again',
  updateFailedNotice:
    "Couldn't update the workspace from this host. Showing the last version that worked.",
  requestOversized: 'This action sends too much at once to reach Dolphin. Try it on fewer files.',
  // Unavailable route
  routeUnavailable: 'This workspace screen is not available on this host.',
  backToHosts: 'Back to hosts',
  backToWorkspaces: 'Back to workspaces'
} as const satisfies MobileCatalogSource
