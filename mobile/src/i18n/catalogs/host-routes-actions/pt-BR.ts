import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesActionsEn } from './en'

export const hostRoutesActionsPtBR: MobileLocaleMessages<typeof hostRoutesActionsEn> = {
  // Home host long-press menu
  connect: 'Conectar',
  reconnect: 'Reconectar',
  disconnect: 'Desconectar',
  networkDiagnostics: 'Diagnóstico de rede',
  editHost: 'Editar host',
  remove: 'Remover',
  // Host route notices
  noticeWorktreeMissing: 'Esse workspace não existe mais neste host.'
}
