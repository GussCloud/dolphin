import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { mobileWebShellEn } from './en'

export const mobileWebShellKo: MobileLocaleMessages<typeof mobileWebShellEn> = {
  // Waiting and progress
  opening: '워크스페이스 여는 중',
  checkingHost: '호스트 확인 중',
  downloading: '워크스페이스 다운로드 중',
  downloadProgress: '파일 {completedAssets}/{totalAssets}개 · {receivedBytes}/{totalBytes}바이트',
  offline: '워크스페이스를 다운로드하려면 이 호스트에 연결하세요',
  loading: '로드 중',
  // Failures
  failureIsolationUnavailable:
    '이 기기의 WebView가 너무 오래되어 워크스페이스를 안전하게 열 수 없습니다.',
  failureDownload: '이 호스트에서 워크스페이스를 다운로드할 수 없습니다.',
  failureStatusUnreadable: '이 호스트의 상태를 읽을 수 없습니다. 뒤로 돌아가 다시 여세요.',
  failureStoppedResponding: '워크스페이스가 응답하지 않습니다.',
  failureCouldNotOpen: '다운로드한 워크스페이스를 열 수 없습니다.',
  tryAgain: '다시 시도',
  updateFailedNotice:
    '이 호스트에서 워크스페이스를 업데이트할 수 없습니다. 마지막으로 작동한 버전을 표시합니다.',
  requestOversized:
    '이 작업은 한 번에 너무 많은 데이터를 보내 Dolphin에 전달할 수 없습니다. 더 적은 파일로 시도하세요.',
  // Unavailable route
  routeUnavailable: '이 호스트에서는 이 워크스페이스 화면을 사용할 수 없습니다.',
  backToHosts: '호스트로 돌아가기',
  backToWorkspaces: '워크스페이스로 돌아가기'
}
