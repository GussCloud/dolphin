import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { appRoutesEn } from './en'

export const appRoutesPtBR: MobileLocaleMessages<typeof appRoutesEn> = {
  back: 'Voltar',
  cancel: 'Cancelar',
  continue: 'Continuar',
  openSettings: 'Abrir configurações',
  tryAgain: 'Tentar novamente',
  backToHome: 'Voltar ao início',
  missingPairingCode: 'Código de pareamento ausente',
  pairConfirmTitle: 'Parear com este desktop?',
  pairConfirmSubtitle:
    'Você abriu um link de pareamento do seu desktop. Confirme para adicioná-lo aos seus hosts.',
  pair: 'Parear',
  connecting: 'Conectando…',
  pairingLog: 'Log de pareamento',
  pairingTimedOut: 'Não foi possível conectar em {seconds}s — veja no log abaixo onde travou',
  pairingFailed: 'Falha no pareamento: {reason}',
  invalidQrCode: 'Não é um QR code válido do Dolphin',
  invalidPairingCode: 'Código de pareamento inválido — copie-o do seu computador e cole novamente',
  pairWithDesktop: 'Parear com o desktop',
  cameraAccessDisabled: 'Acesso à câmera desativado',
  scanPrompt: 'Escaneie o QR code do Dolphin no seu desktop ou cole o código de pareamento.',
  cameraDisabledPrompt: 'Ative o acesso à câmera nas Configurações ou cole o código de pareamento.',
  pasteCodeInstead: 'Colar código',
  orPasteCode: 'Ou cole o código de pareamento',
  pasteCodeTitle: 'Colar código de pareamento',
  pasteCodeMessage: 'Copie o código mostrado abaixo do QR no seu computador.',
  pasteCodePlaceholder: 'dolphin://pair?code=... ou cole o código',
  scanStepOpenDolphin: 'Abra o Dolphin no seu computador',
  scanStepOpenMobileSettings: 'Vá em Configurações → Mobile',
  scanStepScan: 'Escaneie o QR code',
  onboardingSaveChoiceError: 'Não foi possível salvar sua escolha. Tente novamente.',
  onboardingNotificationsError:
    'Não foi possível atualizar as configurações de notificação. Tente novamente.',
  onboardingProgress: 'Progresso da introdução',
  onboardingStep: 'Etapa {current} de {total}'
}
