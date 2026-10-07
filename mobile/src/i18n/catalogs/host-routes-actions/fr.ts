import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesActionsEn } from './en'

export const hostRoutesActionsFr: MobileLocaleMessages<typeof hostRoutesActionsEn> = {
  // Home host long-press menu
  connect: 'Connecter',
  reconnect: 'Reconnecter',
  disconnect: 'Déconnecter',
  networkDiagnostics: 'Diagnostic réseau',
  editHost: 'Modifier l’hôte',
  remove: 'Retirer',
  // Host route notices
  noticeWorktreeMissing: 'Cet espace de travail n’existe plus sur cet hôte.'
}
