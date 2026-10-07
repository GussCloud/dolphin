import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { tasksWorkspaceEn } from './en'

export const tasksWorkspaceEs: MobileLocaleMessages<typeof tasksWorkspaceEn> = {
  // Setup hooks source
  setupSourceLegacy: 'hooks locales',
  setupSourceRepository: 'hooks del repositorio',

  // Workspace create drawer
  selectRepository: 'Seleccionar un repositorio',
  sshConnection: 'Conexión SSH',
  remoteRepository: 'Repositorio remoto',
  connecting: 'Conectando...',
  workspaceName: 'Nombre del espacio de trabajo',
  optionalHint: '[Opcional]',
  agent: 'Agente',
  connectRepositoryFirst: 'Conecta primero el repositorio',
  detectingAgents: 'Detectando agentes...',
  advanced: 'Avanzado',
  startFrom: 'Empezar desde',
  defaultBranch: 'Rama predeterminada',
  createFromRef: 'Crear desde {ref}',
  linearWorkspaceNeedsRepository:
    'Agrega un repositorio Git antes de crear un espacio de trabajo de Linear.',
  repositoryNotFound: 'No se encontró el repositorio.',
  connectRepository: 'Conectar repositorio',

  // Workspace option pickers
  startFromTitle: 'Empezar desde',
  startFromSubtitle: 'Elige una rama o ref existente.',
  searchBranches: 'Buscar ramas',
  defaultBranchSubtitle: 'Usar la base configurada en este repositorio',
  noBranchesMatch: 'Ninguna rama coincide.',
  branchNameLabel: 'Nombre de la rama: {branch}',
  sparseCheckoutTitle: 'Sparse checkout',
  fullCheckout: 'Checkout completo',
  fullCheckoutSubtitle: 'Usar todo el repositorio',
  editPresetLabel: 'Editar {name}',
  newPreset: 'Nuevo preset',

  // Sparse presets and setup trust
  newSparsePreset: 'Nuevo preset de sparse checkout',
  editSparsePreset: 'Editar preset de sparse checkout',
  presetName: 'Nombre',
  presetDirectories: 'Directorios',
  directoryCount: { one: '{count} directorio', other: '{count} directorios' },
  runSetupScriptTitle: '¿Ejecutar el script de configuración?',
  setupChoiceRequired:
    '{repo} requiere elegir una opción de configuración antes de crear este espacio de trabajo.',
  runSetupAndCreate: 'Ejecutar configuración y crear',
  skipSetupAndCreate: 'Omitir configuración y crear',
  setupScriptChanged: 'El script de configuración de {repo} cambió',
  runSetupFrom: '¿Ejecutar la configuración de {repo}?',
  setupTrustWarning:
    'El dolphin.yaml de este repositorio se ejecuta en tu equipo antes de que se inicie el espacio de trabajo. Ejecútalo solo si confías en este repositorio.',
  newSetupScript: 'Nuevo script de configuración',
  setupScript: 'Script de configuración',
  trustSetupScriptError: 'No se pudo confiar en el script de configuración.',
  runHooks: 'Ejecutar hooks',
  alwaysTrustAndRun: 'Confiar siempre y ejecutar',
  dontRun: 'No ejecutar',

  // Workspace create operations
  sshConnected: 'Conectado',
  sshConnecting: 'Conectando',
  sshDeployingRelay: 'Desplegando relay',
  sshReconnecting: 'Reconectando',
  sshAuthFailed: 'Error de autenticación',
  sshReconnectFailed: 'Error al reconectar',
  sshConnectionFailed: 'Error de conexión',
  sshDisconnected: 'Desconectado',
  agentLaunchUnsupportedWarning:
    'Se creó el espacio de trabajo, pero este equipo no puede iniciar el agente desde el teléfono.',
  agentLaunchFailedWarning: 'Se creó el espacio de trabajo, pero el agente no se inició: {reason}',
  searchFailed: 'Error en la búsqueda',
  sparseDirectoriesInvalid:
    'Usa directorios relativos al repositorio, no la raíz, rutas absolutas ni segmentos superiores.',
  sparseDirectoriesEmpty: 'Agrega al menos un directorio.',
  unknownError: 'Error desconocido',
  createWorkspaceError: 'No se pudo crear el espacio de trabajo',

  // Smart workspace source modes
  smartModeSmart: 'Inteligente',
  smartModeBranch: 'Rama',
  smartModeName: 'Nombre',

  // Action errors
  resolveBaseBranchError: 'No se pudo resolver la rama base.',
  agentDisabled:
    'El agente seleccionado está deshabilitado. Elige un agente habilitado antes de crear.',
  nameRequired: 'El nombre es obligatorio.',
  openShellSubtitle: 'Abrir una shell',
  sparsePresetsLoadError: 'No se pudieron cargar los presets de sparse checkout.',
  branchSearchError: 'No se pudieron buscar las ramas.',
  sparsePresetSaveError: 'No se pudo guardar el preset de sparse checkout.',
  sshStateReadError: 'No se pudo leer el estado de la conexión SSH.',
  sshConnectError: 'No se pudo conectar al repositorio SSH.',
  connectRepoBeforeWorkspace: 'Conecta {repo} antes de crear un espacio de trabajo.',
  nameTooLong: 'El nombre debe tener 80 caracteres o menos.',
  nameAlreadyExists: '"{name}" ya existe.',
  blankTerminal: 'Terminal en blanco'
}
