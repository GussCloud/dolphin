import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const settingsEn = {
  // Shared chrome
  back: 'Back',
  on: 'On',
  off: 'Off',
  retry: 'Retry',
  openSettings: 'Open Settings',

  // Menu items, which double as their screens' headings
  settings: 'Settings',
  terminal: 'Terminal',
  chatUi: 'Chat UI',
  browser: 'Browser',
  voice: 'Voice',
  notifications: 'Notifications',
  backgroundConnection: 'Background connection',
  language: 'Language',
  troubleshooting: 'Troubleshooting',
  about: 'About',
  privacyPolicy: 'Privacy Policy',
  support: 'Support',

  // Language
  languageHeading: 'APP LANGUAGE',
  languageDescription: 'Choose the language used by the Dolphin app on this device.',
  languageSystemDefault: 'System default',
  languageSaveError: 'Could not save the language. Try again.',

  // About
  aboutTagline: 'Open-source agent IDE for 100x builders',
  aboutWebsite: 'Dolphin website',
  aboutSourceCode: 'Dolphin source code',
  aboutOnX: 'Dolphin on X',
  aboutOpenLinkError: 'Could not open the link. Try again.',

  // Background connection
  backgroundRelayHeading: 'RELAY',
  backgroundRelayDescription:
    'Keep the Relay connection open after you leave the app so it reopens instantly. While on, Android shows a persistent notification and battery use goes up.',
  backgroundStayConnected: 'Stay connected in background',
  backgroundRetentionOffSubtitle: 'Disconnect shortly after you leave the app.',
  backgroundRetention15m: '15 minutes',
  backgroundRetention15mSubtitle: 'Stay connected for 15 minutes in background.',
  backgroundRetention1h: '1 hour',
  backgroundRetention1hSubtitle: 'Stay connected for 1 hour in background.',
  backgroundRetentionAlways: 'Always',
  backgroundRetentionAlwaysSubtitle: 'Stay connected until you turn this off.',
  backgroundSaveError: 'Could not save background connection. Try again.',
  backgroundSystemHeading: 'SYSTEM',
  backgroundSystemDescription:
    'Battery savers can still close the connection. Allow Dolphin to run unrestricted.',
  backgroundSystemDescriptionWithAutostart:
    'Battery savers can still close the connection. Allow Dolphin to run unrestricted and enable Autostart.',
  backgroundBatteryOptimization: 'Battery optimization',
  backgroundUnrestricted: 'Unrestricted',
  backgroundRestricted: 'Restricted — tap to allow',
  backgroundAutostart: 'Autostart',
  backgroundAutostartHint: 'Required on Xiaomi, Redmi and POCO',

  // Browser
  browserLinksHeading: 'LINKS',
  browserLinksDescription: 'Choose where HTTP(S) links tapped in terminal output open.',
  browserOpenTerminalLinks: 'Open terminal links',
  browserModeDolphin: 'Dolphin browser on desktop',
  browserModeDolphinSubtitle: 'Open in the streamed browser from your paired desktop.',
  browserModePhone: 'Phone browser',
  browserModePhoneSubtitle: 'Open in Safari, Chrome, or another browser on this phone.',
  browserLoadError: 'Could not load browser preferences. Try again.',
  browserSaveError: 'Could not save browser preferences. Try again.',

  // Chat UI
  chatDefaultViewHeading: 'DEFAULT VIEW',
  chatDefaultViewDescription:
    'Choose how supported agent sessions (Claude, Codex, and other chat-capable agents) open on this device. Terminal shows the raw CLI; Chat UI shows a chat interface like the desktop app. You can still switch any individual session from its long-press menu.',
  chatOpenSessionsInChatUi: 'Open sessions in Chat UI',

  // Notifications
  notificationsEnable: 'Enable notifications',
  notificationsDefaultDescription:
    'Get notified on this device when an agent needs your input or finishes a task.',
  notificationsPushDescription:
    'Get agent alerts even when the app is closed. Delivered through Dolphin’s push service and Apple or Google.',
  notificationsBlocked: 'Notifications are disabled in system settings.',
  notificationsLoadError: 'Could not load notification settings. Try again.',
  notificationsSaveError: 'Could not save notification settings. Try again.',
  notificationsOpenSettingsError: 'Could not open system settings. Try again.',
  deliveryLoadError: 'Could not load delivery settings. Reopen this screen to retry.',
  deliverySaveError: 'Could not save delivery settings. Try again.',
  deliveryNeedsUpdatedDesktop: 'Pair an updated desktop to receive notifications on this phone.',

  // Push delivery test
  pushTestHeading: 'Having trouble receiving alerts?',
  pushTestDetail: 'Send a test through Dolphin’s push service.',
  pushTestSend: 'Send test notification',
  pushTestSending: 'Sending…',
  pushTestLoadHostsError: 'Could not load paired desktops.',
  pushTestPairDesktop: 'Pair a desktop and try again.',
  pushTestConnectDesktop: 'Connect a desktop and try again.',
  pushTestUpdateDesktop: 'Update your desktop to run this test.',
  pushTestReachError: 'Could not reach the desktop. Try again.',
  pushTestAccepted: 'Accepted by Dolphin’s push service. Check for the notification.',
  pushTestNotRegistered: 'Reconnect to register this phone for notifications.',
  pushTestRateLimited: 'Too many notifications. Try again later.',
  pushTestSendError: 'Could not send through Dolphin’s push service. Try again.',
  pushTestGenericError: 'Could not send push test.',

  // Pairing credential cleanup
  credentialCleanupTitle: 'Pairing credential cleanup',
  credentialCleanupRetryFailed: "Cleanup still couldn't be confirmed. Try again later.",
  credentialCleanupPending: {
    one: "Couldn't confirm cleanup for {count} credential on this device.",
    other: "Couldn't confirm cleanup for {count} credentials on this device."
  },
  credentialCleanupUnreadable: "Couldn't check cleanup status on this device. Retry to be safe.",
  credentialCleanupRetryLabel: 'Retry clearing pairing credentials',

  // Voice
  voiceConnectDesktop: 'Connect to a desktop to manage voice settings.',
  voiceLoadError: 'Failed to load voice settings.',
  voiceUpdateError: 'Could not update.',
  voiceSelectModelError: 'Could not select model.',
  voiceDownloadError: 'Download failed.',
  voiceDeleteError: 'Delete failed.',
  voiceDictationHeading: 'DICTATION',
  voiceEnableDictation: 'Enable Voice Dictation',
  voiceEnableDictationDescription: 'Dictate text into any focused pane on your desktop.',
  voiceDictationMode: 'Dictation Mode',
  voiceDictationModeDescription:
    'Toggle: press once to start, again to stop. Hold: dictate while held.',
  voiceModeToggle: 'Toggle',
  voiceModeHold: 'Hold',
  voiceSpeechModelHeading: 'SPEECH MODEL',
  voiceSpeechModel: 'Speech Model',
  voiceNoModelSelected: 'None selected',

  // Terminal
  terminalLeaveHeading: 'WHEN YOU LEAVE THE APP',
  terminalLeaveDescription:
    "While you're using a terminal on your phone, Dolphin shrinks it to fit your screen. When you close the app or switch away, this controls whether it stays at phone size (so interactive CLI tools don't reflow) or resizes back to your desktop. You can always use Restore this terminal or Restore all terminals on the banner to resize manually.",
  terminalNoHosts: 'No paired desktops yet. Pair one to control terminal behavior.',
  terminalRestoreKeepPhoneSize: 'Keep at phone size (default)',
  terminalRestoreAfter1Minute: 'After 1 minute',
  terminalRestoreAfter5Minutes: 'After 5 minutes',
  terminalRestoreAfter30Minutes: 'After 30 minutes',
  terminalRestoreAfterSeconds: 'After {seconds}s',
  terminalRestorePickerTitle: 'Restore {host}',
  terminalTextSizeHeading: 'TEXT SIZE',
  terminalTextSizeDescription:
    "Scale the terminal text. Smaller sizes fit more columns with side margins; larger sizes show fewer columns — drag sideways to pan. You can also pinch to zoom in the terminal itself, which updates this setting. Per-device display only; doesn't change the desktop terminal.",
  terminalTextSize: 'Text size',
  terminalTextSizePickerTitle: 'Terminal text size',
  terminalTextSizeSmallest: 'Smallest (50%)',
  terminalTextSizeSmaller: 'Smaller (75%)',
  terminalTextSizeDefault: 'Default (100%)',
  terminalTextSizeLarge: 'Large (125%)',
  terminalTextSizeLarger: 'Larger (150%)',
  terminalTextSizeLargest: 'Largest (200%)',
  terminalKeyboardHeading: 'KEYBOARD INPUT',
  terminalKeyboardDescription:
    "Enable phone-style autocomplete, autocorrect, and spelling suggestions in the terminal command bar. Off by default so the keyboard never rewrites commands, flags, or paths. Direct keyboard input (when keys go straight to the terminal) always sends raw keystrokes, so suggestions don't apply there.",
  terminalAutocomplete: 'Autocomplete & autocorrect'
} as const satisfies MobileCatalogSource
