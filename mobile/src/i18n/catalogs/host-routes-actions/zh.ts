import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesActionsEn } from './en'

export const hostRoutesActionsZh: MobileLocaleMessages<typeof hostRoutesActionsEn> = {
  // Home host long-press menu
  connect: '连接',
  reconnect: '重新连接',
  disconnect: '断开连接',
  networkDiagnostics: '网络诊断',
  editHost: '编辑主机',
  remove: '移除',
  // Host route notices
  noticeWorktreeMissing: '该工作区已不存在于此主机上。'
}
