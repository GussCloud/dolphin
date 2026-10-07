import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { agentHistoryEn } from './en'

export const agentHistoryFr: MobileLocaleMessages<typeof agentHistoryEn> = {
  // Screen chrome
  title: 'Historique des sessions d’agents',
  back: 'Retour',
  refresh: 'Actualiser les sessions d’agents',
  retry: 'Réessayer',
  sourceControl: 'Contrôle de code source',
  // Scope tabs and search
  scopeWorkspace: 'Espace de travail',
  scopeProject: 'Projet',
  scopeAll: 'Tout',
  searchPlaceholder: 'Rechercher des sessions, repo:, path:',
  transcriptsSkipped: {
    one: '{count} transcription ignorée',
    other: '{count} transcriptions ignorées'
  },
  // States
  unavailableTitle: 'Historique des sessions d’agents indisponible',
  unavailableBody:
    'Mettez à jour Dolphin sur cet hôte pour parcourir l’historique des sessions d’agents.',
  loadErrorTitle: 'Chargement impossible',
  emptyTitle: 'Aucune session d’agent',
  emptySearch: 'Aucune session ne correspond à votre recherche.',
  emptyScope: 'Aucune session d’agent passée dans cette portée.',
  waitingForHost: 'En attente de l’hôte…',
  hostUnreachable: 'Impossible de joindre l’hôte',
  sessionsLoadError: 'Impossible de charger les sessions d’agents',
  // Session cards
  untitledSession: 'Session sans titre',
  messageCount: { one: '{count} message', other: '{count} messages' },
  currentWorktree: 'worktree actuel',
  resumeSession: 'Reprendre la session d’agent',
  // Resume
  missingResumeId: 'Il manque un identifiant de reprise à cette session.',
  unknownHostPlatform: 'Impossible de déterminer la plateforme de l’hôte.',
  sessionQueued: 'Session d’agent mise en file d’attente.',
  resumeFailed: 'Échec de la reprise de la session.',
  workspaceMetadataError: 'Impossible de charger les métadonnées de l’espace de travail.',
  blockedRuntime:
    'La reprise depuis l’historique n’est pas disponible dans les espaces de travail hébergés par le runtime.',
  blockedSsh:
    'Cette session est stockée sur la machine hôte et ne peut donc pas être reprise dans un espace de travail SSH. Ouvrez un espace de travail local pour ce projet.',
  blockedNoLocal: 'Ouvrez un espace de travail local avant de reprendre une session.'
}
