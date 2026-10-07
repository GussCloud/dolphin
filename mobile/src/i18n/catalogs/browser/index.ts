import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { browserEn } from './en'
import { browserEs } from './es'
import { browserFr } from './fr'
import { browserJa } from './ja'
import { browserKo } from './ko'
import { browserPtBR } from './pt-BR'
import { browserZh } from './zh'

/** Remote browser pane (`src/browser/**`). */
export const browserCatalog = defineMobileCatalog({
  en: browserEn,
  zh: browserZh,
  ko: browserKo,
  ja: browserJa,
  es: browserEs,
  fr: browserFr,
  'pt-BR': browserPtBR
})
