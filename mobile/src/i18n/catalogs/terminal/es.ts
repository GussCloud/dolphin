import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { terminalEn } from './en'

export const terminalEs: MobileLocaleMessages<typeof terminalEn> = {
  // Engine error overlay
  engineFailedToLoad: 'No se pudo cargar el terminal',
  reload: 'Recargar',

  // Quick commands
  quickCommandInserted: '{label} insertado',
  quickCommandFallbackLabel: 'Comando rápido',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Escape',
  keyTab: 'Tabulador',
  keyShiftTab: 'Mayús Tab',
  keyEnter: 'Intro',
  keySpace: 'Espacio',
  keyBackspace: 'Retroceso',
  keyForwardDelete: 'Suprimir',
  keyInsert: 'Insertar',
  keyArrowUp: 'Flecha arriba',
  keyArrowDown: 'Flecha abajo',
  keyArrowLeft: 'Flecha izquierda',
  keyArrowRight: 'Flecha derecha',
  keyHome: 'Inicio',
  keyEnd: 'Fin',
  keyPageUp: 'Retroceder página',
  keyPageDown: 'Avanzar página',
  keyInterrupt: 'Interrumpir terminal',
  keySendEof: 'Enviar EOF',
  keyClearScreen: 'Limpiar pantalla',
  keySuspend: 'Suspender proceso',
  keyReverseSearch: 'Búsqueda inversa',
  keyStartOfLine: 'Inicio de línea',
  keyEndOfLine: 'Fin de línea',
  keyDeleteWordBackward: 'Borrar palabra anterior',
  keyClearLineBeforeCursor: 'Borrar línea antes del cursor'
}
