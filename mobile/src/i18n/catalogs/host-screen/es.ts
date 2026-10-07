import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostScreenEn } from './en'

export const hostScreenEs: MobileLocaleMessages<typeof hostScreenEn> = {
  // Shared
  cancel: 'Cancelar',
  delete: 'Eliminar',
  remove: 'Quitar',
  accounts: 'Cuentas',
  tasks: 'Tareas',
  // Header
  backToHosts: 'Volver a los hosts',
  reconnect: 'Reconectar',
  floatingWorkspace: 'Espacio de trabajo flotante',
  hideSidebar: 'Ocultar barra lateral',
  newWorkspace: 'Nuevo espacio de trabajo',
  closeSearch: 'Cerrar búsqueda',
  searchWorkspaces: 'Buscar espacios de trabajo',
  // Toolbar
  filter: 'Filtrar',
  filterWithCount: 'Filtrar {count}',
  filterWithCountParens: 'Filtrar ({count})',
  filterWorkspaces: 'Filtrar espacios de trabajo',
  filterWorkspacesActive: {
    one: 'Filtrar espacios de trabajo, {count} activo',
    other: 'Filtrar espacios de trabajo, {count} activos'
  },
  sortBy: 'Ordenar por {label}',
  groupWorkspaces: 'Agrupar espacios de trabajo',
  group: 'Agrupar',
  groupStatusShort: 'Estado',
  groupRepoShort: 'Repo',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: 'Ordenar por',
  groupByTitle: 'Agrupar por',
  clearFilters: 'Borrar filtros',
  filterWorkspacesSection: 'Espacios de trabajo',
  hideSleeping: 'Ocultar los suspendidos',
  hideDefaultBranch: 'Ocultar rama predeterminada',
  filterRepositoriesSection: 'Repositorios',
  searchWorktreesPlaceholder: 'Buscar worktrees…',
  searchWorktrees: 'Buscar worktrees',
  // Worktree actions
  sleep: 'Suspender',
  pin: 'Fijar',
  unpin: 'Desfijar',
  deleteWorktreeTitle: 'Eliminar worktree',
  deleteWorktreeMessage: '¿Eliminar "{name}" ({branch})?',
  // Host
  removeHostTitle: 'Quitar host',
  removeHostMessage: '¿Quitar "{name}"? Puedes volver a vincularlo más tarde.',
  removeHostError: 'No se pudo quitar el host. Inténtalo de nuevo.',
  hostNotFound: 'Host no encontrado'
}
