import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const browserEn = {
  // Toolbar
  back: 'Back',
  forward: 'Forward',
  reload: 'Reload',
  urlPlaceholder: 'URL',
  showWebView: 'Show web website view',
  showMobileView: 'Show mobile website view',
  // Keyboard dock
  clickModifier: '{key} click modifier',
  typeOnPage: 'Type on page…',
  sendText: 'Send text to browser',
  sent: 'Sent',
  rightClick: 'Right click',
  // Page dialogs
  dialogTitle: 'Browser Dialog',
  dialogFallback: 'Browser dialog',
  cancel: 'Cancel',
  ok: 'OK',
  dialogAnswerFailed: 'That answer did not reach the page.',
  // Errors
  invalidUrl: 'Enter a valid URL.',
  streamFailed: 'Browser stream failed.',
  commandFailed: 'Browser command failed',
  updateAppForStreaming: 'Update the Dolphin app to stream browser tabs here.',
  updateDesktopForStreaming: 'Update desktop Dolphin to stream browser tabs on mobile.',
  checkingStreamingSupport: 'Checking desktop browser streaming support.',
  pageNotAvailable: 'Browser page is not available yet.',
  streamTimedOut: 'Browser stream timed out.'
} as const satisfies MobileCatalogSource
