import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { mobileWebShellEn } from './en'

export const mobileWebShellFr: MobileLocaleMessages<typeof mobileWebShellEn> = {
  // Waiting and progress
  opening: 'Ouverture de l’espace de travail',
  checkingHost: 'Vérification de l’hôte',
  downloading: 'Téléchargement de l’espace de travail',
  downloadProgress:
    '{completedAssets}/{totalAssets} fichiers · {receivedBytes}/{totalBytes} octets',
  offline: 'Connectez-vous à cet hôte pour télécharger l’espace de travail',
  loading: 'Chargement',
  // Failures
  failureIsolationUnavailable:
    'Le WebView de cet appareil est trop ancien pour ouvrir l’espace de travail en toute sécurité.',
  failureDownload: 'Impossible de télécharger l’espace de travail depuis cet hôte.',
  failureStatusUnreadable:
    'Impossible de lire l’état de cet hôte. Revenez en arrière et rouvrez-le.',
  failureStoppedResponding: 'L’espace de travail ne répond plus.',
  failureCouldNotOpen: 'Impossible d’ouvrir l’espace de travail téléchargé.',
  tryAgain: 'Réessayer',
  updateFailedNotice:
    'Impossible de mettre à jour l’espace de travail depuis cet hôte. Affichage de la dernière version fonctionnelle.',
  requestOversized:
    'Cette action envoie trop de données à la fois pour atteindre Dolphin. Essayez avec moins de fichiers.',
  // Unavailable route
  routeUnavailable: 'Cet écran de l’espace de travail n’est pas disponible sur cet hôte.',
  backToHosts: 'Retour aux hôtes',
  backToWorkspaces: 'Retour aux espaces de travail'
}
