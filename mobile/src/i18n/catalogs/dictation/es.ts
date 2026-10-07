import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { dictationEn } from './en'

export const dictationEs: MobileLocaleMessages<typeof dictationEn> = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop:
    'Actualiza la app de Dolphin del escritorio vinculado para usar los ajustes de voz del móvil.',
  loadModelsFailed: 'No se pudieron cargar los modelos de dictado',
  downloadFailed: 'No se pudo iniciar la descarga',
  deleteFailed: 'No se pudo eliminar el modelo',
  updateSettingsFailed: 'No se pudieron actualizar los ajustes de dictado',
  microphonePermissionDenied: 'Permiso de micrófono denegado',
  microphoneInitFailed: 'No se pudo inicializar el micrófono'
}
