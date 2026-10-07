import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { appRoutesEn } from './en'

export const appRoutesEs: MobileLocaleMessages<typeof appRoutesEn> = {
  back: 'Atrás',
  cancel: 'Cancelar',
  continue: 'Continuar',
  openSettings: 'Abrir Ajustes',
  tryAgain: 'Intentar de nuevo',
  backToHome: 'Volver al inicio',
  missingPairingCode: 'Falta el código de vinculación',
  pairConfirmTitle: '¿Vincular con este escritorio?',
  pairConfirmSubtitle:
    'Abriste un enlace de vinculación desde tu escritorio. Confirma para añadirlo a tus hosts.',
  pair: 'Vincular',
  connecting: 'Conectando…',
  pairingLog: 'Registro de vinculación',
  pairingTimedOut:
    'No se pudo conectar en {seconds} s — consulta el registro de abajo para ver dónde se detuvo',
  pairingFailed: 'La vinculación falló: {reason}',
  invalidQrCode: 'No es un código QR válido de Dolphin',
  invalidPairingCode:
    'No es un código de vinculación válido — cópialo desde tu computadora y pégalo de nuevo',
  pairWithDesktop: 'Vincular con el escritorio',
  cameraAccessDisabled: 'Acceso a la cámara desactivado',
  scanPrompt: 'Escanea el código QR de Dolphin en tu escritorio o pega el código de vinculación.',
  cameraDisabledPrompt: 'Activa el acceso a la cámara en Ajustes o pega el código de vinculación.',
  pasteCodeInstead: 'Pegar código',
  orPasteCode: 'O pega el código de vinculación',
  pasteCodeTitle: 'Pegar código de vinculación',
  pasteCodeMessage: 'Copia el código que aparece debajo del QR en tu computadora.',
  pasteCodePlaceholder: 'dolphin://pair?code=... o pega el código',
  scanStepOpenDolphin: 'Abre Dolphin en tu computadora',
  scanStepOpenMobileSettings: 'Ve a Ajustes → Móvil',
  scanStepScan: 'Escanea el código QR',
  onboardingSaveChoiceError: 'No se pudo guardar tu elección. Inténtalo de nuevo.',
  onboardingNotificationsError:
    'No se pudieron actualizar los ajustes de notificaciones. Inténtalo de nuevo.',
  onboardingProgress: 'Progreso de la configuración inicial',
  onboardingStep: 'Paso {current} de {total}'
}
