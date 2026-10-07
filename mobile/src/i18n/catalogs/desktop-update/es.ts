import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { desktopUpdateEn } from './en'

export const desktopUpdateEs: MobileLocaleMessages<typeof desktopUpdateEn> = {
  // Host card tag
  tagAvailable: 'Actualización disponible',
  tagReady: 'Actualización lista',
  tagManual: 'Actualización disponible · Instálala en el escritorio',
  tagStarting: 'Iniciando actualización…',
  tagDownloading: 'Descargando {percent} %',
  tagInstalling: 'Reiniciando escritorio…',
  tagFailed: 'Error al actualizar · Reintentar',
  // Install confirmation
  confirmInstallVersion:
    '¿Instalar Dolphin {version} en "{hostName}"? Dolphin se reiniciará en ese escritorio.',
  confirmInstallLatest:
    '¿Instalar la última versión de Dolphin en "{hostName}"? Dolphin se reiniciará en ese escritorio.',
  confirmLastAttemptFailed: 'El último intento falló: {message}',
  // Errors
  errorRestartedOnOlder:
    'El escritorio se reinició con {installedVersion}; {targetVersion} no se instaló.',
  errorManualRequired: 'Este escritorio debe actualizarse manualmente.',
  errorNotAvailable: 'El escritorio ya no indica ninguna actualización disponible.',
  errorNotDownloaded: 'La actualización aún no ha terminado de descargarse en el escritorio.',
  errorUpdaterTimeout: 'Se agotó el tiempo de espera del actualizador del escritorio.'
}
