import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const onboardingEn = {
  // Session view step
  sessionViewTitle: 'How should sessions open?',
  sessionViewBody:
    'Choose whether supported agent sessions open in the terminal or Chat UI on this device. Press and hold a session tab to switch its view, or change the default later in Settings.',
  useChatUi: 'Use Chat UI',
  useChatUiA11y: 'Open sessions in Chat UI',
  keepTerminal: 'Keep terminal',
  keepTerminalA11y: 'Open sessions in the terminal',
  // Notifications step
  notificationsTitle: 'Don’t miss when an agent needs you',
  notificationsBody:
    'Get a notification on this phone when an agent finishes or is waiting — even if you aren’t using the app.',
  notificationsDisclosure:
    'Delivered through Dolphin’s push service after your desktop has been idle for 3 minutes. Change this anytime in Settings.',
  enableNotifications: 'Enable notifications',
  enableNotificationsA11y: 'Enable agent notifications',
  notNow: 'Not now',
  notNowA11y: 'Skip notifications for now',
  // Sample notification banners
  sampleNow: 'now',
  sampleCodexTitle: 'Codex finished',
  sampleCodexBody: 'Tests are passing.',
  sampleClaudeTitle: 'Claude needs input',
  sampleClaudeBody: 'Waiting on you.'
} as const satisfies MobileCatalogSource
