import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { terminalEn } from './en'

export const terminalJa: MobileLocaleMessages<typeof terminalEn> = {
  // Engine error overlay
  engineFailedToLoad: 'ターミナルを読み込めませんでした',
  reload: '再読み込み',

  // Quick commands
  quickCommandInserted: '{label}を挿入しました',
  quickCommandFallbackLabel: 'クイックコマンド',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Esc キー',
  keyTab: 'Tab キー',
  keyShiftTab: 'Shift Tab',
  keyEnter: 'Enter キー',
  keySpace: 'スペース',
  keyBackspace: 'バックスペース',
  keyForwardDelete: '前方削除',
  keyInsert: 'Insert キー',
  keyArrowUp: '上矢印',
  keyArrowDown: '下矢印',
  keyArrowLeft: '左矢印',
  keyArrowRight: '右矢印',
  keyHome: 'Home キー',
  keyEnd: 'End キー',
  keyPageUp: 'Page Up',
  keyPageDown: 'Page Down',
  keyInterrupt: 'ターミナルを中断',
  keySendEof: 'EOF を送信',
  keyClearScreen: '画面をクリア',
  keySuspend: 'プロセスを一時停止',
  keyReverseSearch: '逆方向検索',
  keyStartOfLine: '行頭',
  keyEndOfLine: '行末',
  keyDeleteWordBackward: '前の単語を削除',
  keyClearLineBeforeCursor: 'カーソルより前の行をクリア'
}
