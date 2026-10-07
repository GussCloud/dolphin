import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { desktopUpdateEn } from './en'

export const desktopUpdateFr: MobileLocaleMessages<typeof desktopUpdateEn> = {
  // Host card tag
  tagAvailable: 'Mise à jour disponible',
  tagReady: 'Mise à jour prête',
  tagManual: 'Mise à jour disponible · À installer sur l’ordinateur',
  tagStarting: 'Démarrage de la mise à jour…',
  tagDownloading: 'Téléchargement {percent} %',
  tagInstalling: 'Redémarrage de l’ordinateur…',
  tagFailed: 'Échec de la mise à jour · Réessayer',
  // Install confirmation
  confirmInstallVersion:
    'Installer Dolphin {version} sur « {hostName} » ? Dolphin redémarrera sur cet ordinateur.',
  confirmInstallLatest:
    'Installer la dernière version de Dolphin sur « {hostName} » ? Dolphin redémarrera sur cet ordinateur.',
  confirmLastAttemptFailed: 'La dernière tentative a échoué : {message}',
  // Errors
  errorRestartedOnOlder:
    'L’ordinateur a redémarré en {installedVersion} ; {targetVersion} n’a pas été installée.',
  errorManualRequired: 'Cet ordinateur doit être mis à jour manuellement.',
  errorNotAvailable: 'L’ordinateur ne signale plus de mise à jour disponible.',
  errorNotDownloaded: 'La mise à jour n’a pas fini de se télécharger sur l’ordinateur.',
  errorUpdaterTimeout: 'Délai dépassé en attendant le programme de mise à jour de l’ordinateur.'
}
