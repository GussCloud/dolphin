import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { terminalEn } from './en'

export const terminalFr: MobileLocaleMessages<typeof terminalEn> = {
  // Engine error overlay
  engineFailedToLoad: 'Échec du chargement du terminal',
  reload: 'Recharger',

  // Quick commands
  quickCommandInserted: '{label} inséré',
  quickCommandFallbackLabel: 'Commande rapide',

  // Accessory and shortcut key screen-reader labels
  keyEscape: 'Échap',
  keyTab: 'Tab',
  keyShiftTab: 'Maj Tab',
  keyEnter: 'Entrée',
  keySpace: 'Espace',
  keyBackspace: 'Retour arrière',
  keyForwardDelete: 'Suppr',
  keyInsert: 'Insér',
  keyArrowUp: 'Flèche haut',
  keyArrowDown: 'Flèche bas',
  keyArrowLeft: 'Flèche gauche',
  keyArrowRight: 'Flèche droite',
  keyHome: 'Début',
  keyEnd: 'Fin',
  keyPageUp: 'Page précédente',
  keyPageDown: 'Page suivante',
  keyInterrupt: 'Interrompre le terminal',
  keySendEof: 'Envoyer EOF',
  keyClearScreen: 'Effacer l’écran',
  keySuspend: 'Suspendre le processus',
  keyReverseSearch: 'Recherche inversée',
  keyStartOfLine: 'Début de ligne',
  keyEndOfLine: 'Fin de ligne',
  keyDeleteWordBackward: 'Supprimer le mot précédent',
  keyClearLineBeforeCursor: 'Effacer la ligne avant le curseur'
}
