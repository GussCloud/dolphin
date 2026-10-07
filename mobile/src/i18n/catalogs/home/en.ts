import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const homeEn = {
  // Shared
  pleaseTryAgain: 'Please try again.',
  remove: 'Remove',
  update: 'Update',
  tasks: 'Tasks',
  openSettings: 'Open settings',
  // Host actions
  checkPairingErrorTitle: 'Could not check pairing',
  removeHostErrorTitle: 'Could not remove host',
  removeHostTitle: 'Remove Host',
  removeHostMessage: 'Remove "{name}"? You can re-pair later.',
  updateDesktopTitle: 'Update Desktop',
  // Empty state
  emptyTitle: 'Connect your desktop',
  emptyBody:
    'Pair with Dolphin on your computer to check on your agents, jump into any terminal, and drive work from your phone.',
  pairDesktop: 'Pair Desktop',
  howItWorks: 'How it works',
  stepOpenDesktopTitle: 'Open Dolphin desktop',
  stepOpenDesktopDesc: 'Go to Settings → Mobile and generate a pairing QR code.',
  stepScanTitle: 'Scan the code',
  stepScanDesc: 'Tap the button above to open the scanner. Point at the QR code on your screen.',
  stepConnectedTitle: "You're connected",
  stepConnectedDesc: 'Your desktop will appear here. Everything is encrypted end-to-end.',
  // List header and footer
  welcomeBack: 'Welcome back',
  statAgentsSpawned: 'Agents spawned',
  statAgentTime: 'Agent time',
  statPRsCreated: 'PRs created',
  durationDaysHours: '{days}d {hours}h',
  durationHoursMinutes: '{hours}h {minutes}m',
  durationMinutes: '{minutes}m',
  desktops: 'Desktops',
  resume: 'Resume',
  accountUsage: 'Account usage',
  systemDefaultAccount: 'System default',
  noTaskSources: 'No task sources connected',
  openProviderTasks: 'Open {provider} tasks'
} as const satisfies MobileCatalogSource
