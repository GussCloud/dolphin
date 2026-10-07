import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { filesEn } from './en'

export const filesKo: MobileLocaleMessages<typeof filesEn> = {
  // Explorer
  title: '파일',
  worktreeShowingFirst: '{worktree} - 처음 {count}개만 표시',
  closeFiles: '파일 닫기',
  backToSession: '세션으로 돌아가기',
  retry: '다시 시도',
  noFilesFound: '파일을 찾을 수 없음',
  unableToLoadFiles: '파일을 불러올 수 없습니다',
  connectingToDesktop: '데스크톱에 연결 중...',
  waitingForDesktop: '데스크톱을 기다리는 중...',
  loading: '불러오는 중...',
  unableToLoadFolder: '폴더를 불러올 수 없습니다',
  retryLoadingA11y: '{path} 다시 불러오기',
  openFolderA11y: '{name} 폴더 열기',
  previewFileA11y: '{name} 파일 미리보기',
  unavailableOnMobileA11y: '{name}은(는) 모바일에서 사용할 수 없습니다',
  unavailableOnMobile: '모바일에서 사용할 수 없음',

  // Preview
  preview: '미리보기',
  file: '파일',
  backToFiles: '파일로 돌아가기',
  saveArtifactA11y: '터미널 아티팩트 저장',
  discardChangesTitle: '변경 사항을 버릴까요?',
  unsavedEditsLost: '저장하지 않은 편집 내용이 사라집니다.',
  discard: '버리기',
  stay: '머무르기',
  loadingPreview: '미리보기 불러오는 중...',
  emptyFile: '빈 파일',
  imageA11y: '{title} 이미지',
  editorA11y: '{title} 편집기',
  filePreviewA11y: '파일 미리보기',
  viewMarkdownSourceA11y: 'Markdown 소스 보기',
  viewRenderedMarkdownA11y: '렌더링된 Markdown 미리보기 보기',
  previewTruncated: '미리보기가 잘렸습니다. 파일 크기: {size}.',
  unknownSize: '알 수 없는 크기',

  // Preview errors
  unableToLoadPreview: '미리보기를 불러올 수 없습니다',
  unableToSaveFile: '파일을 저장할 수 없습니다',
  binaryPreviewUnavailable: '바이너리 미리보기를 사용할 수 없습니다',
  fileTooLarge: '파일이 너무 커서 모바일에서 미리 볼 수 없습니다',
  reloadBeforeSaving: '저장하기 전에 미리보기를 다시 불러오세요',
  unableToReachFilesystem: '데스크톱 파일 시스템에 연결할 수 없습니다',
  fileNotFound: '파일을 찾을 수 없음',
  fileChangedOnDesktop:
    '데스크톱에서 파일이 변경되었습니다. 저장하기 전에 미리보기를 다시 불러오세요',
  sshOwnerChanged: 'SSH 연결을 확인할 수 없습니다. 호스트에 다시 연결한 후 다시 시도하세요.'
}
