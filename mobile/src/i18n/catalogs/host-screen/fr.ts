import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostScreenEn } from './en'

export const hostScreenFr: MobileLocaleMessages<typeof hostScreenEn> = {
  // Shared
  cancel: 'Annuler',
  delete: 'Supprimer',
  remove: 'Retirer',
  accounts: 'Comptes',
  tasks: 'Tâches',
  // Header
  backToHosts: 'Retour aux hôtes',
  reconnect: 'Reconnecter',
  floatingWorkspace: 'Espace de travail flottant',
  hideSidebar: 'Masquer la barre latérale',
  newWorkspace: 'Nouvel espace de travail',
  closeSearch: 'Fermer la recherche',
  searchWorkspaces: 'Rechercher des espaces de travail',
  // Toolbar
  filter: 'Filtrer',
  filterWithCount: 'Filtrer {count}',
  filterWithCountParens: 'Filtrer ({count})',
  filterWorkspaces: 'Filtrer les espaces de travail',
  filterWorkspacesActive: {
    one: 'Filtrer les espaces de travail, {count} actif',
    other: 'Filtrer les espaces de travail, {count} actifs'
  },
  sortBy: 'Trier par {label}',
  groupWorkspaces: 'Regrouper les espaces de travail',
  group: 'Grouper',
  groupStatusShort: 'Statut',
  groupRepoShort: 'Dépôt',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: 'Trier par',
  groupByTitle: 'Regrouper par',
  clearFilters: 'Effacer les filtres',
  filterWorkspacesSection: 'Espaces de travail',
  hideSleeping: 'Masquer les espaces en veille',
  hideDefaultBranch: 'Masquer la branche par défaut',
  filterRepositoriesSection: 'Dépôts',
  searchWorktreesPlaceholder: 'Rechercher des worktrees…',
  searchWorktrees: 'Rechercher des worktrees',
  // Worktree actions
  sleep: 'Mettre en veille',
  pin: 'Épingler',
  unpin: 'Désépingler',
  deleteWorktreeTitle: 'Supprimer le worktree',
  deleteWorktreeMessage: 'Supprimer « {name} » ({branch}) ?',
  // Host
  removeHostTitle: 'Retirer l’hôte',
  removeHostMessage: 'Retirer « {name} » ? Vous pourrez l’associer de nouveau plus tard.',
  removeHostError: 'Impossible de retirer l’hôte. Veuillez réessayer.',
  hostNotFound: 'Hôte introuvable'
}
