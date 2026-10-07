import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const notificationsEn = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Dolphin silent notifications',
  desktopChannelName: 'Desktop Notifications',
  // Delivery preferences
  onlyWhenAway: 'Only when away from desktop',
  onlyWhenAwayHint: 'After 3 minutes without keyboard or mouse activity, or when locked.',
  sound: 'Notification sound',
  suppressWhileFocused: 'Suppress while focused',
  suppressWhileFocusedHint: 'Skip alerts for the workspace open on this phone.',
  footer:
    'Alert types follow each paired desktop’s notification settings. Notifications pause after 7 days without using this app; open it and reconnect to resume.'
} as const satisfies MobileCatalogSource
