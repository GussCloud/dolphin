import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { terminalEn } from './en'

export const terminalPtBR: MobileLocaleMessages<typeof terminalEn> = {
  // Engine error overlay
  engineFailedToLoad: 'Falha ao carregar o terminal',
  reload: 'Recarregar',

  // Quick commands
  quickCommandInserted: '{label} inserido',
  quickCommandFallbackLabel: 'Comando rápido',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Escape',
  keyTab: 'Tab',
  keyShiftTab: 'Shift Tab',
  keyEnter: 'Enter',
  keySpace: 'Espaço',
  keyBackspace: 'Backspace',
  keyForwardDelete: 'Apagar à frente',
  keyInsert: 'Insert',
  keyArrowUp: 'Seta para cima',
  keyArrowDown: 'Seta para baixo',
  keyArrowLeft: 'Seta para a esquerda',
  keyArrowRight: 'Seta para a direita',
  keyHome: 'Home',
  keyEnd: 'End',
  keyPageUp: 'Page Up',
  keyPageDown: 'Page Down',
  keyInterrupt: 'Interromper terminal',
  keySendEof: 'Enviar EOF',
  keyClearScreen: 'Limpar tela',
  keySuspend: 'Suspender processo',
  keyReverseSearch: 'Busca reversa',
  keyStartOfLine: 'Início da linha',
  keyEndOfLine: 'Fim da linha',
  keyDeleteWordBackward: 'Apagar palavra anterior',
  keyClearLineBeforeCursor: 'Limpar linha antes do cursor'
}
