import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { browserEn } from './en'

export const browserEs: MobileLocaleMessages<typeof browserEn> = {
  // Toolbar
  back: 'Atrás',
  forward: 'Adelante',
  reload: 'Recargar',
  urlPlaceholder: 'URL',
  showWebView: 'Mostrar la vista web del sitio',
  showMobileView: 'Mostrar la vista móvil del sitio',
  // Keyboard dock
  clickModifier: 'Modificador de clic {key}',
  typeOnPage: 'Escribe en la página…',
  sendText: 'Enviar texto al navegador',
  sent: 'Enviado',
  rightClick: 'Clic derecho',
  // Page dialogs
  dialogTitle: 'Diálogo del navegador',
  dialogFallback: 'Diálogo del navegador',
  cancel: 'Cancelar',
  ok: 'Aceptar',
  dialogAnswerFailed: 'Esa respuesta no llegó a la página.',
  // Errors
  invalidUrl: 'Introduce una URL válida.',
  streamFailed: 'Falló la transmisión del navegador.',
  commandFailed: 'Falló el comando del navegador',
  updateAppForStreaming: 'Actualiza la app de Dolphin para transmitir pestañas del navegador aquí.',
  updateDesktopForStreaming:
    'Actualiza Dolphin en el escritorio para transmitir pestañas del navegador en el móvil.',
  checkingStreamingSupport:
    'Comprobando la compatibilidad de transmisión del navegador del escritorio.',
  pageNotAvailable: 'La página del navegador aún no está disponible.',
  streamTimedOut: 'Se agotó el tiempo de la transmisión del navegador.'
}
