import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesActionsEn } from './en'

export const hostRoutesActionsKo: MobileLocaleMessages<typeof hostRoutesActionsEn> = {
  // Home host long-press menu
  connect: '연결',
  reconnect: '다시 연결',
  disconnect: '연결 해제',
  networkDiagnostics: '네트워크 진단',
  editHost: '호스트 편집',
  remove: '제거',
  // Host route notices
  noticeWorktreeMissing: '이 호스트에 해당 워크스페이스가 더 이상 없습니다.'
}
