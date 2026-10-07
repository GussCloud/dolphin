import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { worktreeEn } from './en'

export const worktreeKo: MobileLocaleMessages<typeof worktreeEn> = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: '작업 중',
  agentMonitoring: '백그라운드 작업 모니터링 중',
  agentBlocked: '차단됨',
  agentWaiting: '입력 대기 중',
  agentInterrupted: '중단됨',
  agentDone: '완료',
  agentIdle: '유휴',
  agentUnverifiable: '확인 불가',
  teammate: '팀원',
  // Host card summary
  worktreeListUnavailable: '워크트리 목록을 사용할 수 없음',
  worktreeCount: { one: '워크트리 {count}개', other: '워크트리 {count}개' },
  worktreeCountWithActive: '{worktrees} · 활성 {active}개',
  lastKnown: '마지막 확인: {summary}',
  // Workspace list states
  catalogLoadError: '이 호스트에서 워크스페이스를 불러올 수 없습니다',
  catalogLoadErrorDetail: '{command} 실패({error}) — 자동으로 다시 시도 중',
  emptySearch: '일치하는 워크트리가 없습니다',
  emptyFiltered: '필터와 일치하는 워크트리가 없습니다',
  empty: '워크트리가 없습니다',
  // Sections
  sectionPinned: '고정됨',
  sectionAll: '전체',
  prGroupDone: '완료',
  prGroupInReview: '검토 중',
  prGroupInProgress: '진행 중',
  prGroupClosed: '닫힘',
  // Sort and group pickers
  sortSmart: '에이전트 활동',
  sortSmartSubtitle: '주의가 필요한 에이전트, 그다음 최근 활동',
  sortName: '이름',
  sortNameSubtitle: '이름 알파벳순',
  sortRecent: '최근',
  sortRecentSubtitle: '최근 출력 순',
  sortRepo: '저장소',
  sortRepoSubtitle: '저장소, 그다음 워크스페이스 이름',
  sortManual: '수동',
  sortManualSubtitle: '서버 순서',
  groupNone: '그룹 없음',
  groupStatus: '상태',
  groupRepository: '저장소',
  groupPrStatus: 'PR 상태',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: '방금',
  timeMinutes: '{minutes}분',
  timeHours: '{hours}시간',
  timeDays: '{days}일'
}
