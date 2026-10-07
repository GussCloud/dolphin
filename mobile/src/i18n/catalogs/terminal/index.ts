import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { terminalEn } from './en'
import { terminalEs } from './es'
import { terminalFr } from './fr'
import { terminalJa } from './ja'
import { terminalKo } from './ko'
import { terminalPtBR } from './pt-BR'
import { terminalZh } from './zh'

/** Terminal views (`src/terminal/**`, React Native side only). */
export const terminalCatalog = defineMobileCatalog({
  en: terminalEn,
  zh: terminalZh,
  ko: terminalKo,
  ja: terminalJa,
  es: terminalEs,
  fr: terminalFr,
  'pt-BR': terminalPtBR
})
