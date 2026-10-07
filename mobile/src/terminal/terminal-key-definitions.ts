import type { TerminalAccessoryKey, TerminalShortcutSpecialKey } from './terminal-accessory-keys'
import type { terminalEn } from '../i18n/catalogs/terminal/en'
import { terminalText } from './terminal-text'

export const SPECIAL_KEY_LABELS: Record<string, string> = {
  escape: 'Esc',
  tab: 'Tab',
  enter: 'Enter',
  backspace: '⌫',
  delete: 'Del',
  insert: 'Ins',
  arrowUp: '↑',
  arrowDown: '↓',
  arrowLeft: '←',
  arrowRight: '→',
  home: 'Home',
  end: 'End',
  pageUp: 'PgUp',
  pageDown: 'PgDn',
  space: 'Space',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
  f6: 'F6',
  f7: 'F7',
  f8: 'F8',
  f9: 'F9',
  f10: 'F10',
  f11: 'F11',
  f12: 'F12'
}

// Catalog keys, not copy: the labels are read through getters so each read uses the active locale.
const SPECIAL_KEY_ACCESSIBILITY_KEYS: Record<string, TerminalKeyA11yKey> = {
  escape: 'keyEscape',
  tab: 'keyTab',
  enter: 'keyEnter',
  backspace: 'keyBackspace',
  delete: 'keyForwardDelete',
  insert: 'keyInsert',
  arrowUp: 'keyArrowUp',
  arrowDown: 'keyArrowDown',
  arrowLeft: 'keyArrowLeft',
  arrowRight: 'keyArrowRight',
  home: 'keyHome',
  end: 'keyEnd',
  pageUp: 'keyPageUp',
  pageDown: 'keyPageDown',
  space: 'keySpace'
}

type TerminalKeyA11yKey = Extract<keyof typeof terminalEn, `key${string}`>

/** Function keys keep their own name; everything else reads the catalog. */
function keyAccessibilityLabel(id: string): string {
  const key = SPECIAL_KEY_ACCESSIBILITY_KEYS[id]
  return key ? terminalText(key) : (SPECIAL_KEY_LABELS[id] ?? id)
}

function accessoryKey(
  id: string,
  label: string,
  bytes: string,
  a11yKey: TerminalKeyA11yKey,
  repeatable?: boolean
): TerminalAccessoryKey {
  return {
    id,
    label,
    bytes,
    get accessibilityLabel() {
      return terminalText(a11yKey)
    },
    ...(repeatable ? { repeatable } : {})
  }
}

export const TERMINAL_SHORTCUT_SPECIAL_KEY_DEFINITIONS: TerminalShortcutSpecialKey[] = [
  'escape',
  'tab',
  'enter',
  'backspace',
  'delete',
  'insert',
  'arrowUp',
  'arrowDown',
  'arrowLeft',
  'arrowRight',
  'home',
  'end',
  'pageUp',
  'pageDown',
  'space',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12'
].map((id) => ({
  id,
  label: SPECIAL_KEY_LABELS[id]!,
  get accessibilityLabel() {
    return keyAccessibilityLabel(id)
  }
}))

export const TERMINAL_ACCESSORY_KEY_DEFINITIONS: TerminalAccessoryKey[] = [
  accessoryKey('escape', 'Esc', '\x1b', 'keyEscape'),
  accessoryKey('tab', 'Tab', '\t', 'keyTab'),
  accessoryKey('enter', 'Enter', '\r', 'keyEnter'),
  // Why: terminal apps recognize ESC [ Z as the reverse-tab sequence.
  accessoryKey('shiftTab', 'Shift+Tab', '\x1b[Z', 'keyShiftTab'),
  accessoryKey('space', 'Space', ' ', 'keySpace'),
  accessoryKey('backspace', '⌫', '\x7f', 'keyBackspace', true),
  accessoryKey('delete', 'Del', '\x1b[3~', 'keyForwardDelete', true),
  accessoryKey('arrowUp', '↑', '\x1b[A', 'keyArrowUp', true),
  accessoryKey('arrowDown', '↓', '\x1b[B', 'keyArrowDown', true),
  accessoryKey('arrowLeft', '←', '\x1b[D', 'keyArrowLeft', true),
  accessoryKey('arrowRight', '→', '\x1b[C', 'keyArrowRight', true),
  accessoryKey('ctrlC', 'Ctrl+C', '\x03', 'keyInterrupt'),
  accessoryKey('ctrlD', 'Ctrl+D', '\x04', 'keySendEof'),
  accessoryKey('ctrlL', 'Ctrl+L', '\x0c', 'keyClearScreen'),
  accessoryKey('ctrlZ', 'Ctrl+Z', '\x1a', 'keySuspend'),
  accessoryKey('ctrlR', 'Ctrl+R', '\x12', 'keyReverseSearch'),
  accessoryKey('ctrlA', 'Ctrl+A', '\x01', 'keyStartOfLine'),
  accessoryKey('ctrlE', 'Ctrl+E', '\x05', 'keyEndOfLine'),
  accessoryKey('ctrlW', 'Ctrl+W', '\x17', 'keyDeleteWordBackward'),
  accessoryKey('ctrlU', 'Ctrl+U', '\x15', 'keyClearLineBeforeCursor')
]
