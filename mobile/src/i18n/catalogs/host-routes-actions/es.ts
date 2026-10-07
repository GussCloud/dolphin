import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesActionsEn } from './en'

export const hostRoutesActionsEs: MobileLocaleMessages<typeof hostRoutesActionsEn> = {
  // Home host long-press menu
  connect: 'Conectar',
  reconnect: 'Reconectar',
  disconnect: 'Desconectar',
  networkDiagnostics: 'Diagnóstico de red',
  editHost: 'Editar host',
  remove: 'Quitar',
  // Host route notices
  noticeWorktreeMissing: 'Ese espacio de trabajo ya no existe en este host.'
}
