import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { mobileWebShellEn } from './en'

export const mobileWebShellEs: MobileLocaleMessages<typeof mobileWebShellEn> = {
  // Waiting and progress
  opening: 'Abriendo espacio de trabajo',
  checkingHost: 'Comprobando host',
  downloading: 'Descargando espacio de trabajo',
  downloadProgress: '{completedAssets}/{totalAssets} archivos · {receivedBytes}/{totalBytes} bytes',
  offline: 'Conéctate a este host para descargar el espacio de trabajo',
  loading: 'Cargando',
  // Failures
  failureIsolationUnavailable:
    'El WebView de este dispositivo es demasiado antiguo para abrir el espacio de trabajo de forma segura.',
  failureDownload: 'No se pudo descargar el espacio de trabajo desde este host.',
  failureStatusUnreadable:
    'No se pudo leer el estado de este host. Vuelve atrás y ábrelo de nuevo.',
  failureStoppedResponding: 'El espacio de trabajo dejó de responder.',
  failureCouldNotOpen: 'No se pudo abrir el espacio de trabajo descargado.',
  tryAgain: 'Reintentar',
  updateFailedNotice:
    'No se pudo actualizar el espacio de trabajo desde este host. Se muestra la última versión que funcionó.',
  requestOversized:
    'Esta acción envía demasiado a la vez para llegar a Dolphin. Pruébala con menos archivos.',
  // Unavailable route
  routeUnavailable: 'Esta pantalla del espacio de trabajo no está disponible en este host.',
  backToHosts: 'Volver a los hosts',
  backToWorkspaces: 'Volver a los espacios de trabajo'
}
