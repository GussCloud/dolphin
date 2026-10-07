import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { sessionReviewEn } from './en'

export const sessionReviewKo: MobileLocaleMessages<typeof sessionReviewEn> = {
  committedChangesUnavailable: '커밋된 변경 사항을 사용할 수 없습니다',
  committedChangesFailed: '커밋된 변경 사항을 불러오지 못했습니다',
  updateDesktopToReview: '모바일에서 변경 사항을 검토하려면 Dolphin 데스크톱을 업데이트하세요.',
  loadChangesFailed: '변경 사항을 불러올 수 없습니다',
  sourceControlResponseInvalid: '소스 제어 응답이 올바르지 않습니다',
  loadReviewNotesFailed: '리뷰 노트를 불러올 수 없습니다',
  loadDiffFailed: '변경 사항을 불러올 수 없습니다',
  committedDiffUnavailable: '커밋된 변경 사항 비교를 사용할 수 없습니다',

  scopeBranch: '브랜치',
  scopeStaged: '스테이징됨',
  scopeUnstaged: '스테이징 안 됨',
  committedOnBranch: '브랜치에 커밋됨',

  waitingForDesktop: '데스크톱을 기다리는 중...',
  sourceControlActionFailed: '소스 제어 작업이 실패했습니다',
  stagedWithFailures: '{staged}개 스테이징됨, {failed}개 실패',
  reviewedFilesStaged: {
    one: '검토한 파일 {count}개 스테이징됨',
    other: '검토한 파일 {count}개 스테이징됨'
  },
  saveReviewStateFailed: '리뷰 상태를 저장하지 못했습니다',
  saveReviewFailed: '리뷰를 저장하지 못했습니다',
  missingWorktree: '작업 트리가 없습니다',
  loadReviewFailed: '리뷰를 불러올 수 없습니다',
  openInSessionFailed: '세션에서 열 수 없습니다',
  copyReviewNotesFailed: '리뷰 노트를 복사할 수 없습니다',
  reviewNotesCopied: '리뷰 노트를 복사했습니다',
  sendNotesFailed: '노트를 보내지 못했습니다',
  terminalInputLocked: '터미널 입력이 잠겨 있습니다',
  reviewNotesSent: '리뷰 노트를 보냈습니다',
  createTerminalFailed: '터미널을 만들지 못했습니다',
  loadAgentSessionsFailed: '에이전트 세션을 불러올 수 없습니다',

  requestFailed: '요청 실패: {method}',
  refreshPullRequestFailed: '풀 리퀘스트를 새로고침하지 못했습니다.',
  mergePullRequestFailed: '풀 리퀘스트를 병합하지 못했습니다.',
  notConnected: '연결되지 않음',
  notConnectedToDesktop: '데스크톱에 연결되어 있지 않습니다.',
  waitingForDesktopEllipsis: '데스크톱을 기다리는 중…',
  launchAgentFailed: '에이전트를 시작하지 못했습니다',
  commentActionFailed: '댓글 작업이 실패했습니다',
  updateTitleFailed: '제목을 업데이트하지 못했습니다.',
  updateReviewThreadFailed: '리뷰 스레드를 업데이트하지 못했습니다.',
  loadPullRequestFailed: '풀 리퀘스트를 불러올 수 없습니다',
  sendPromptFailed: '프롬프트를 보내지 못했습니다',

  sendResumeCommandFailed: '재개 명령을 보내지 못했습니다',
  prepareLegacyCodexFailed: '이 레거시 Codex 세션을 준비할 수 없습니다. 다시 재개해 보세요.'
}
