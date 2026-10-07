import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { terminalEn } from './en'

export const terminalZh: MobileLocaleMessages<typeof terminalEn> = {
  // Engine error overlay
  engineFailedToLoad: '终端加载失败',
  reload: '重新加载',

  // Quick commands
  quickCommandInserted: '已插入{label}',
  quickCommandFallbackLabel: '快捷命令',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Esc 键',
  keyTab: 'Tab 键',
  keyShiftTab: 'Shift Tab',
  keyEnter: '回车',
  keySpace: '空格',
  keyBackspace: '退格',
  keyForwardDelete: '向前删除',
  keyInsert: '插入',
  keyArrowUp: '上箭头',
  keyArrowDown: '下箭头',
  keyArrowLeft: '左箭头',
  keyArrowRight: '右箭头',
  keyHome: 'Home 键',
  keyEnd: 'End 键',
  keyPageUp: '向上翻页',
  keyPageDown: '向下翻页',
  keyInterrupt: '中断终端',
  keySendEof: '发送 EOF',
  keyClearScreen: '清屏',
  keySuspend: '挂起进程',
  keyReverseSearch: '反向搜索',
  keyStartOfLine: '行首',
  keyEndOfLine: '行尾',
  keyDeleteWordBackward: '向后删除单词',
  keyClearLineBeforeCursor: '清除光标前的内容'
}
