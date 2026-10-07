import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { terminalEn } from './en'

export const terminalKo: MobileLocaleMessages<typeof terminalEn> = {
  // Engine error overlay
  engineFailedToLoad: '터미널을 불러오지 못했습니다',
  reload: '새로고침',

  // Quick commands
  quickCommandInserted: '{label} 삽입됨',
  quickCommandFallbackLabel: '빠른 명령',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Esc 키',
  keyTab: 'Tab 키',
  keyShiftTab: 'Shift Tab',
  keyEnter: 'Enter 키',
  keySpace: '스페이스',
  keyBackspace: '백스페이스',
  keyForwardDelete: '앞으로 삭제',
  keyInsert: 'Insert 키',
  keyArrowUp: '위쪽 화살표',
  keyArrowDown: '아래쪽 화살표',
  keyArrowLeft: '왼쪽 화살표',
  keyArrowRight: '오른쪽 화살표',
  keyHome: 'Home 키',
  keyEnd: 'End 키',
  keyPageUp: 'Page Up',
  keyPageDown: 'Page Down',
  keyInterrupt: '터미널 중단',
  keySendEof: 'EOF 보내기',
  keyClearScreen: '화면 지우기',
  keySuspend: '프로세스 일시 중지',
  keyReverseSearch: '역방향 검색',
  keyStartOfLine: '줄 시작',
  keyEndOfLine: '줄 끝',
  keyDeleteWordBackward: '이전 단어 삭제',
  keyClearLineBeforeCursor: '커서 앞 줄 지우기'
}
