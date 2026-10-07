import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesActionsEn } from './en'

export const hostRoutesActionsJa: MobileLocaleMessages<typeof hostRoutesActionsEn> = {
  // Home host long-press menu
  connect: '接続',
  reconnect: '再接続',
  disconnect: '切断',
  networkDiagnostics: 'ネットワーク診断',
  editHost: 'ホストを編集',
  remove: '削除',
  // Host route notices
  noticeWorktreeMissing: 'そのワークスペースはこのホストにもう存在しません。'
}
