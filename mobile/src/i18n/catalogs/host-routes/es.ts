import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesEn } from './en'

export const hostRoutesEs: MobileLocaleMessages<typeof hostRoutesEn> = {
  // Route titles
  routeHost: 'Host',
  routeAccounts: 'Cuentas',
  routeTasks: 'Tareas',
  routeTerminal: 'Terminal',
  routeSourceControl: 'Control de código fuente',
  routeAgentHistory: 'Historial de sesiones del agente',
  routeChanges: 'Cambios',
  routePullRequest: 'Pull request',
  routeWorkspace: 'Espacio de trabajo',

  // Edit host
  editHost: 'Editar host',
  back: 'Atrás',
  save: 'Guardar',
  saveHostA11y: 'Guardar host',
  goBack: 'Volver',
  missingHost: 'Falta el host.',
  hostRemoved: 'Este host se eliminó de este teléfono.',
  failedToLoadHost: 'No se pudo cargar el host.',
  failedToSaveHost: 'No se pudo guardar el host.',
  editHelp:
    'Cambia el nombre visible o la dirección de conexión. Deja el nombre vacío para usar el que informa el escritorio. Cambiar la dirección solo modifica adónde se conecta este teléfono; no vuelve a emparejar. Úsalo cuando el mismo escritorio sea accesible desde otra IP (por ejemplo, la LAN de casa frente a Tailscale).',
  name: 'Nombre',
  hostNamePlaceholder: 'Nombre del host',
  address: 'Dirección',
  addressHint:
    'Acepta IP, host:puerto o ws:// / wss://. Si falta el puerto, se usa el actual (o 6768).',
  connectsTo: 'Se conecta a {endpoint}',

  // Accounts
  accounts: 'Cuentas',
  invalidSnapshot: 'Datos de cuentas no válidos recibidos del host',
  hostNotFound: 'Host no encontrado',
  couldNotSwitchAccount: 'No se pudo cambiar de cuenta',
  systemDefault: 'Predeterminado del sistema',
  useAgentLogin: 'Usar el inicio de sesión propio del agente',
  connectingToHost: 'Conectando con {host}…',
  connectingToHostGeneric: 'Conectando con el host…',
  loadingAccounts: 'Cargando cuentas…',
  addAccountsHint: 'Añade o vuelve a autenticar cuentas en Ajustes → Cuentas del escritorio.'
}
