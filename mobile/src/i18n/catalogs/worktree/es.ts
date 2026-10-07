import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { worktreeEn } from './en'

export const worktreeEs: MobileLocaleMessages<typeof worktreeEn> = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: 'Trabajando',
  agentMonitoring: 'Supervisando tareas en segundo plano',
  agentBlocked: 'Bloqueado',
  agentWaiting: 'Esperando respuesta',
  agentInterrupted: 'Interrumpido',
  agentDone: 'Hecho',
  agentIdle: 'Inactivo',
  agentUnverifiable: 'No verificable',
  teammate: 'Compañero',
  // Host card summary
  worktreeListUnavailable: 'Lista de worktrees no disponible',
  worktreeCount: { one: '{count} worktree', other: '{count} worktrees' },
  worktreeCountWithActive: '{worktrees} · {active} activos',
  lastKnown: 'Último dato: {summary}',
  // Workspace list states
  catalogLoadError: 'No se pudieron cargar los espacios de trabajo de este host',
  catalogLoadErrorDetail: '{command} falló ({error}): reintentando automáticamente',
  emptySearch: 'No hay worktrees que coincidan',
  emptyFiltered: 'Ningún worktree coincide con los filtros',
  empty: 'No hay worktrees',
  // Sections
  sectionPinned: 'Fijados',
  sectionAll: 'Todos',
  prGroupDone: 'Hecho',
  prGroupInReview: 'En revisión',
  prGroupInProgress: 'En curso',
  prGroupClosed: 'Cerrado',
  // Sort and group pickers
  sortSmart: 'Actividad de agentes',
  sortSmartSubtitle: 'Primero los agentes que necesitan atención, luego la actividad reciente',
  sortName: 'Nombre',
  sortNameSubtitle: 'Orden alfabético por nombre',
  sortRecent: 'Recientes',
  sortRecentSubtitle: 'Primero la salida más reciente',
  sortRepo: 'Repositorio',
  sortRepoSubtitle: 'Repositorio y luego nombre del espacio de trabajo',
  sortManual: 'Manual',
  sortManualSubtitle: 'Orden del servidor',
  groupNone: 'Sin agrupar',
  groupStatus: 'Estado',
  groupRepository: 'Repositorio',
  groupPrStatus: 'Estado del PR',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: 'ahora mismo',
  timeMinutes: '{minutes} min',
  timeHours: '{hours} h',
  timeDays: '{days} d'
}
