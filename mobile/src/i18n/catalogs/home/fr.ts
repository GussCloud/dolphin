import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { homeEn } from './en'

export const homeFr: MobileLocaleMessages<typeof homeEn> = {
  // Shared
  pleaseTryAgain: 'Veuillez réessayer.',
  remove: 'Retirer',
  update: 'Mettre à jour',
  tasks: 'Tâches',
  openSettings: 'Ouvrir les réglages',
  // Host actions
  checkPairingErrorTitle: 'Impossible de vérifier l’association',
  removeHostErrorTitle: 'Impossible de retirer l’hôte',
  removeHostTitle: 'Retirer l’hôte',
  removeHostMessage: 'Retirer « {name} » ? Vous pourrez l’associer de nouveau plus tard.',
  updateDesktopTitle: 'Mettre à jour l’ordinateur',
  // Empty state
  emptyTitle: 'Connectez votre ordinateur',
  emptyBody:
    'Associez Dolphin sur votre ordinateur pour suivre vos agents, ouvrir n’importe quel terminal et piloter votre travail depuis votre téléphone.',
  pairDesktop: 'Associer un ordinateur',
  howItWorks: 'Comment ça marche',
  stepOpenDesktopTitle: 'Ouvrez Dolphin sur l’ordinateur',
  stepOpenDesktopDesc: 'Allez dans Réglages → Mobile et générez un QR code d’association.',
  stepScanTitle: 'Scannez le code',
  stepScanDesc:
    'Touchez le bouton ci-dessus pour ouvrir le scanner. Visez le QR code affiché sur votre écran.',
  stepConnectedTitle: 'Vous êtes connecté',
  stepConnectedDesc: 'Votre ordinateur apparaîtra ici. Tout est chiffré de bout en bout.',
  // List header and footer
  welcomeBack: 'Bon retour',
  statAgentsSpawned: 'Agents lancés',
  statAgentTime: 'Temps des agents',
  statPRsCreated: 'PR créées',
  durationDaysHours: '{days} j {hours} h',
  durationHoursMinutes: '{hours} h {minutes} min',
  durationMinutes: '{minutes} min',
  desktops: 'Ordinateurs',
  resume: 'Reprendre',
  accountUsage: 'Utilisation du compte',
  systemDefaultAccount: 'Par défaut du système',
  noTaskSources: 'Aucune source de tâches connectée',
  openProviderTasks: 'Ouvrir les tâches {provider}'
}
