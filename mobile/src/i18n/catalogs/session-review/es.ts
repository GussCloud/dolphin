import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { sessionReviewEn } from './en'

export const sessionReviewEs: MobileLocaleMessages<typeof sessionReviewEn> = {
  committedChangesUnavailable: 'Los cambios confirmados no están disponibles',
  committedChangesFailed: 'Error al cargar los cambios confirmados',
  updateDesktopToReview: 'Actualiza Dolphin para escritorio para revisar cambios en el móvil.',
  loadChangesFailed: 'No se pudieron cargar los cambios',
  sourceControlResponseInvalid: 'La respuesta del control de código fuente no es válida',
  loadReviewNotesFailed: 'No se pudieron cargar las notas de revisión',
  loadDiffFailed: 'No se pudo cargar el diff',
  committedDiffUnavailable: 'El diff confirmado no está disponible',

  scopeBranch: 'Rama',
  scopeStaged: 'Preparado',
  scopeUnstaged: 'Sin preparar',
  committedOnBranch: 'Confirmado en la rama',

  waitingForDesktop: 'Esperando al escritorio...',
  sourceControlActionFailed: 'Falló la acción de control de código fuente',
  stagedWithFailures: '{staged} preparados, {failed} con errores',
  reviewedFilesStaged: {
    one: '{count} archivo revisado preparado',
    other: '{count} archivos revisados preparados'
  },
  saveReviewStateFailed: 'No se pudo guardar el estado de la revisión',
  saveReviewFailed: 'No se pudo guardar la revisión',
  missingWorktree: 'Falta el worktree',
  loadReviewFailed: 'No se pudo cargar la revisión',
  openInSessionFailed: 'No se pudo abrir en la sesión',
  copyReviewNotesFailed: 'No se pudieron copiar las notas de revisión',
  reviewNotesCopied: 'Notas de revisión copiadas',
  sendNotesFailed: 'No se pudieron enviar las notas',
  terminalInputLocked: 'La entrada de la terminal está bloqueada',
  reviewNotesSent: 'Notas de revisión enviadas',
  createTerminalFailed: 'No se pudo crear la terminal',
  loadAgentSessionsFailed: 'No se pudieron cargar las sesiones de agentes',

  requestFailed: 'Error en la solicitud: {method}',
  refreshPullRequestFailed: 'No se pudo actualizar la pull request.',
  mergePullRequestFailed: 'No se pudo fusionar la pull request.',
  notConnected: 'Sin conexión',
  notConnectedToDesktop: 'No hay conexión con el escritorio.',
  waitingForDesktopEllipsis: 'Esperando al escritorio…',
  launchAgentFailed: 'No se pudo iniciar el agente',
  commentActionFailed: 'Falló la acción del comentario',
  updateTitleFailed: 'No se pudo actualizar el título.',
  updateReviewThreadFailed: 'No se pudo actualizar el hilo de revisión.',
  loadPullRequestFailed: 'No se pudo cargar la pull request',
  sendPromptFailed: 'No se pudo enviar el prompt',

  sendResumeCommandFailed: 'No se pudo enviar el comando de reanudación',
  prepareLegacyCodexFailed:
    'No se pudo preparar esta sesión heredada de Codex. Vuelve a intentar reanudarla.'
}
