import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { browserEn } from './en'

export const browserKo: MobileLocaleMessages<typeof browserEn> = {
  // Toolbar
  back: '뒤로',
  forward: '앞으로',
  reload: '새로고침',
  urlPlaceholder: 'URL',
  showWebView: '웹 버전 웹사이트 보기',
  showMobileView: '모바일 버전 웹사이트 보기',
  // Keyboard dock
  clickModifier: '{key} 클릭 보조 키',
  typeOnPage: '페이지에 입력…',
  sendText: '브라우저로 텍스트 보내기',
  sent: '보냄',
  rightClick: '오른쪽 클릭',
  // Page dialogs
  dialogTitle: '브라우저 대화 상자',
  dialogFallback: '브라우저 대화 상자',
  cancel: '취소',
  ok: '확인',
  dialogAnswerFailed: '응답이 페이지에 전달되지 않았습니다.',
  // Errors
  invalidUrl: '올바른 URL을 입력하세요.',
  streamFailed: '브라우저 스트림에 실패했습니다.',
  commandFailed: '브라우저 명령 실패',
  updateAppForStreaming: '여기서 브라우저 탭을 스트리밍하려면 Dolphin 앱을 업데이트하세요.',
  updateDesktopForStreaming:
    '모바일에서 브라우저 탭을 스트리밍하려면 데스크톱 Dolphin을 업데이트하세요.',
  checkingStreamingSupport: '데스크톱 브라우저 스트리밍 지원을 확인하는 중입니다.',
  pageNotAvailable: '브라우저 페이지를 아직 사용할 수 없습니다.',
  streamTimedOut: '브라우저 스트림 시간이 초과되었습니다.'
}
