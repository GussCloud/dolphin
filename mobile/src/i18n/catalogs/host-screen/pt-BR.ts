import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostScreenEn } from './en'

export const hostScreenPtBR: MobileLocaleMessages<typeof hostScreenEn> = {
  // Shared
  cancel: 'Cancelar',
  delete: 'Excluir',
  remove: 'Remover',
  accounts: 'Contas',
  tasks: 'Tarefas',
  // Header
  backToHosts: 'Voltar aos hosts',
  reconnect: 'Reconectar',
  floatingWorkspace: 'Workspace flutuante',
  hideSidebar: 'Ocultar barra lateral',
  newWorkspace: 'Novo workspace',
  closeSearch: 'Fechar busca',
  searchWorkspaces: 'Buscar workspaces',
  // Toolbar
  filter: 'Filtrar',
  filterWithCount: 'Filtrar {count}',
  filterWithCountParens: 'Filtrar ({count})',
  filterWorkspaces: 'Filtrar workspaces',
  filterWorkspacesActive: {
    one: 'Filtrar workspaces, {count} ativo',
    other: 'Filtrar workspaces, {count} ativos'
  },
  sortBy: 'Ordenar por {label}',
  groupWorkspaces: 'Agrupar workspaces',
  group: 'Agrupar',
  groupStatusShort: 'Status',
  groupRepoShort: 'Repo',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: 'Ordenar por',
  groupByTitle: 'Agrupar por',
  clearFilters: 'Limpar filtros',
  filterWorkspacesSection: 'Workspaces',
  hideSleeping: 'Ocultar suspensos',
  hideDefaultBranch: 'Ocultar branch padrão',
  filterRepositoriesSection: 'Repositórios',
  searchWorktreesPlaceholder: 'Buscar worktrees…',
  searchWorktrees: 'Buscar worktrees',
  // Worktree actions
  sleep: 'Suspender',
  pin: 'Fixar',
  unpin: 'Desafixar',
  deleteWorktreeTitle: 'Excluir worktree',
  deleteWorktreeMessage: 'Excluir "{name}" ({branch})?',
  // Host
  removeHostTitle: 'Remover host',
  removeHostMessage: 'Remover "{name}"? Você pode parear de novo depois.',
  removeHostError: 'Não foi possível remover o host. Tente novamente.',
  hostNotFound: 'Host não encontrado'
}
