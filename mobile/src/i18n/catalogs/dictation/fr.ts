import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { dictationEn } from './en'

export const dictationFr: MobileLocaleMessages<typeof dictationEn> = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop:
    'Mettez à jour l’app Dolphin de l’ordinateur associé pour utiliser les réglages vocaux sur mobile.',
  loadModelsFailed: 'Échec du chargement des modèles de dictée',
  downloadFailed: 'Impossible de démarrer le téléchargement',
  deleteFailed: 'Échec de la suppression du modèle',
  updateSettingsFailed: 'Échec de la mise à jour des réglages de dictée',
  microphonePermissionDenied: 'Accès au micro refusé',
  microphoneInitFailed: 'Échec de l’initialisation du micro'
}
