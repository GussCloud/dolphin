import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { worktreeEn } from './en'

export const worktreeFr: MobileLocaleMessages<typeof worktreeEn> = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: 'En cours',
  agentMonitoring: 'Surveillance des tâches en arrière-plan',
  agentBlocked: 'Bloqué',
  agentWaiting: 'En attente d’une réponse',
  agentInterrupted: 'Interrompu',
  agentDone: 'Terminé',
  agentIdle: 'Inactif',
  agentUnverifiable: 'Invérifiable',
  teammate: 'Coéquipier',
  // Host card summary
  worktreeListUnavailable: 'Liste des worktrees indisponible',
  worktreeCount: { one: '{count} worktree', other: '{count} worktrees' },
  worktreeCountWithActive: '{worktrees} · {active} actifs',
  lastKnown: 'Dernier état connu : {summary}',
  // Workspace list states
  catalogLoadError: 'Impossible de charger les espaces de travail de cet hôte',
  catalogLoadErrorDetail: 'Échec de {command} ({error}) — nouvelle tentative automatique',
  emptySearch: 'Aucun worktree correspondant',
  emptyFiltered: 'Aucun worktree ne correspond aux filtres',
  empty: 'Aucun worktree',
  // Sections
  sectionPinned: 'Épinglés',
  sectionAll: 'Tous',
  prGroupDone: 'Terminé',
  prGroupInReview: 'En revue',
  prGroupInProgress: 'En cours',
  prGroupClosed: 'Fermé',
  // Sort and group pickers
  sortSmart: 'Activité des agents',
  sortSmartSubtitle: 'Agents nécessitant votre attention, puis activité récente',
  sortName: 'Nom',
  sortNameSubtitle: 'Ordre alphabétique',
  sortRecent: 'Récents',
  sortRecentSubtitle: 'Sortie la plus récente en premier',
  sortRepo: 'Dépôt',
  sortRepoSubtitle: 'Dépôt, puis nom de l’espace de travail',
  sortManual: 'Manuel',
  sortManualSubtitle: 'Ordre du serveur',
  groupNone: 'Aucun regroupement',
  groupStatus: 'Statut',
  groupRepository: 'Dépôt',
  groupPrStatus: 'Statut de la PR',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: 'à l’instant',
  timeMinutes: '{minutes} min',
  timeHours: '{hours} h',
  timeDays: '{days} j'
}
