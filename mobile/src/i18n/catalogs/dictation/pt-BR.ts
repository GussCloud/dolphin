import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { dictationEn } from './en'

export const dictationPtBR: MobileLocaleMessages<typeof dictationEn> = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop:
    'Atualize o app Dolphin do desktop pareado para usar as configurações de voz no celular.',
  loadModelsFailed: 'Falha ao carregar os modelos de ditado',
  downloadFailed: 'Falha ao iniciar o download',
  deleteFailed: 'Falha ao excluir o modelo',
  updateSettingsFailed: 'Falha ao atualizar as configurações de ditado',
  microphonePermissionDenied: 'Permissão do microfone negada',
  microphoneInitFailed: 'Falha ao inicializar o microfone'
}
