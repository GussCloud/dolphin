import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { agentHistoryEn } from './en'

export const agentHistoryEs: MobileLocaleMessages<typeof agentHistoryEn> = {
  // Screen chrome
  title: 'Historial de sesiones de agentes',
  back: 'Atrás',
  refresh: 'Actualizar sesiones de agentes',
  retry: 'Reintentar',
  sourceControl: 'Control de código fuente',
  // Scope tabs and search
  scopeWorkspace: 'Espacio de trabajo',
  scopeProject: 'Proyecto',
  scopeAll: 'Todo',
  searchPlaceholder: 'Buscar sesiones, repo:, path:',
  transcriptsSkipped: {
    one: '{count} transcripción omitida',
    other: '{count} transcripciones omitidas'
  },
  // States
  unavailableTitle: 'Historial de sesiones de agentes no disponible',
  unavailableBody: 'Actualiza Dolphin en este host para ver el historial de sesiones de agentes.',
  loadErrorTitle: 'No se pudo cargar',
  emptyTitle: 'No hay sesiones de agentes',
  emptySearch: 'Ninguna sesión coincide con tu búsqueda.',
  emptyScope: 'No hay sesiones de agentes anteriores en este ámbito.',
  waitingForHost: 'Esperando al host…',
  hostUnreachable: 'No se puede contactar con el host',
  sessionsLoadError: 'No se pudieron cargar las sesiones de agentes',
  // Session cards
  untitledSession: 'Sesión sin título',
  messageCount: { one: '{count} mensaje', other: '{count} mensajes' },
  currentWorktree: 'worktree actual',
  resumeSession: 'Reanudar sesión de agente',
  // Resume
  missingResumeId: 'A esta sesión le falta un ID de reanudación.',
  unknownHostPlatform: 'No se pudo determinar la plataforma del host.',
  sessionQueued: 'Sesión de agente en cola.',
  resumeFailed: 'No se pudo reanudar la sesión.',
  workspaceMetadataError: 'No se pudieron cargar los metadatos del espacio de trabajo.',
  blockedRuntime:
    'Reanudar desde el historial no está disponible en espacios de trabajo alojados en runtime.',
  blockedSsh:
    'Esta sesión está guardada en la máquina host, así que no se puede reanudar en un espacio de trabajo SSH. Abre un espacio de trabajo local para este proyecto.',
  blockedNoLocal: 'Abre un espacio de trabajo local antes de reanudar una sesión.'
}
