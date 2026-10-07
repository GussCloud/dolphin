import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const hostRoutesActionsEn = {
  // Home host long-press menu
  connect: 'Connect',
  reconnect: 'Reconnect',
  disconnect: 'Disconnect',
  networkDiagnostics: 'Network diagnostics',
  editHost: 'Edit host',
  remove: 'Remove',
  // Host route notices
  noticeWorktreeMissing: 'That workspace no longer exists on this host.'
} as const satisfies MobileCatalogSource
