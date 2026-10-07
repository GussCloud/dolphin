import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { agentHistoryEn } from './en'

export const agentHistoryKo: MobileLocaleMessages<typeof agentHistoryEn> = {
  // Screen chrome
  title: '에이전트 세션 기록',
  back: '뒤로',
  refresh: '에이전트 세션 새로고침',
  retry: '다시 시도',
  sourceControl: '소스 제어',
  // Scope tabs and search
  scopeWorkspace: '워크스페이스',
  scopeProject: '프로젝트',
  scopeAll: '전체',
  searchPlaceholder: '세션, repo:, path: 검색',
  transcriptsSkipped: { one: '대화 기록 {count}개 건너뜀', other: '대화 기록 {count}개 건너뜀' },
  // States
  unavailableTitle: '에이전트 세션 기록을 사용할 수 없음',
  unavailableBody: '에이전트 세션 기록을 보려면 이 호스트의 Dolphin을 업데이트하세요.',
  loadErrorTitle: '불러올 수 없음',
  emptyTitle: '에이전트 세션 없음',
  emptySearch: '검색과 일치하는 세션이 없습니다.',
  emptyScope: '이 범위에 지난 에이전트 세션이 없습니다.',
  waitingForHost: '호스트를 기다리는 중…',
  hostUnreachable: '호스트에 연결할 수 없음',
  sessionsLoadError: '에이전트 세션을 불러올 수 없음',
  // Session cards
  untitledSession: '제목 없는 세션',
  messageCount: { one: '메시지 {count}개', other: '메시지 {count}개' },
  currentWorktree: '현재 워크트리',
  resumeSession: '에이전트 세션 재개',
  // Resume
  missingResumeId: '이 세션에는 재개 ID가 없습니다.',
  unknownHostPlatform: '호스트 플랫폼을 확인할 수 없습니다.',
  sessionQueued: '에이전트 세션이 대기열에 추가되었습니다.',
  resumeFailed: '세션을 재개하지 못했습니다.',
  workspaceMetadataError: '워크스페이스 메타데이터를 불러올 수 없습니다.',
  blockedRuntime: '런타임 호스팅 워크스페이스에서는 기록에서 재개할 수 없습니다.',
  blockedSsh:
    '이 세션은 호스트 컴퓨터에 저장되어 있어 SSH 워크스페이스에서는 재개할 수 없습니다. 이 프로젝트의 로컬 워크스페이스를 여세요.',
  blockedNoLocal: '세션을 재개하기 전에 로컬 워크스페이스를 여세요.'
}
