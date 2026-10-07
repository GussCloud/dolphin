import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostScreenEn } from './en'

export const hostScreenKo: MobileLocaleMessages<typeof hostScreenEn> = {
  // Shared
  cancel: '취소',
  delete: '삭제',
  remove: '제거',
  accounts: '계정',
  tasks: '작업',
  // Header
  backToHosts: '호스트로 돌아가기',
  reconnect: '다시 연결',
  floatingWorkspace: '플로팅 워크스페이스',
  hideSidebar: '사이드바 숨기기',
  newWorkspace: '새 워크스페이스',
  closeSearch: '검색 닫기',
  searchWorkspaces: '워크스페이스 검색',
  // Toolbar
  filter: '필터',
  filterWithCount: '필터 {count}',
  filterWithCountParens: '필터 ({count})',
  filterWorkspaces: '워크스페이스 필터',
  filterWorkspacesActive: {
    one: '워크스페이스 필터, {count}개 사용 중',
    other: '워크스페이스 필터, {count}개 사용 중'
  },
  sortBy: '정렬 기준: {label}',
  groupWorkspaces: '워크스페이스 그룹화',
  group: '그룹',
  groupStatusShort: '상태',
  groupRepoShort: '저장소',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: '정렬 기준',
  groupByTitle: '그룹 기준',
  clearFilters: '필터 지우기',
  filterWorkspacesSection: '워크스페이스',
  hideSleeping: '잠자는 항목 숨기기',
  hideDefaultBranch: '기본 브랜치 숨기기',
  filterRepositoriesSection: '저장소',
  searchWorktreesPlaceholder: '워크트리 검색…',
  searchWorktrees: '워크트리 검색',
  // Worktree actions
  sleep: '잠자기',
  pin: '고정',
  unpin: '고정 해제',
  deleteWorktreeTitle: '워크트리 삭제',
  deleteWorktreeMessage: '"{name}"({branch})을(를) 삭제할까요?',
  // Host
  removeHostTitle: '호스트 제거',
  removeHostMessage: '"{name}"을(를) 제거할까요? 나중에 다시 페어링할 수 있습니다.',
  removeHostError: '호스트를 제거할 수 없습니다. 다시 시도해 주세요.',
  hostNotFound: '호스트를 찾을 수 없음'
}
