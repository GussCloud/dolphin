import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const dictationEn = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop: 'Update the paired desktop Dolphin app to use mobile voice settings.',
  loadModelsFailed: 'Failed to load dictation models',
  downloadFailed: 'Failed to start download',
  deleteFailed: 'Failed to delete model',
  updateSettingsFailed: 'Failed to update dictation settings',
  microphonePermissionDenied: 'Microphone permission denied',
  microphoneInitFailed: 'Failed to initialize microphone'
} as const satisfies MobileCatalogSource
