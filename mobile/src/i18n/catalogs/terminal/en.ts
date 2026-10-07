import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const terminalEn = {
  // Engine error overlay
  engineFailedToLoad: 'Terminal failed to load',
  reload: 'Reload',

  // Quick commands
  quickCommandInserted: '{label} inserted',
  quickCommandFallbackLabel: 'Quick command',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Escape',
  keyTab: 'Tab',
  keyShiftTab: 'Shift Tab',
  keyEnter: 'Enter',
  keySpace: 'Space',
  keyBackspace: 'Backspace',
  keyForwardDelete: 'Forward delete',
  keyInsert: 'Insert',
  keyArrowUp: 'Arrow up',
  keyArrowDown: 'Arrow down',
  keyArrowLeft: 'Arrow left',
  keyArrowRight: 'Arrow right',
  keyHome: 'Home',
  keyEnd: 'End',
  keyPageUp: 'Page up',
  keyPageDown: 'Page down',
  keyInterrupt: 'Interrupt terminal',
  keySendEof: 'Send EOF',
  keyClearScreen: 'Clear screen',
  keySuspend: 'Suspend process',
  keyReverseSearch: 'Reverse search',
  keyStartOfLine: 'Start of line',
  keyEndOfLine: 'End of line',
  keyDeleteWordBackward: 'Delete word backward',
  keyClearLineBeforeCursor: 'Clear line before cursor'
} as const satisfies MobileCatalogSource
