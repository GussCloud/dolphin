import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { platformEn } from './en'
import { platformEs } from './es'
import { platformFr } from './fr'
import { platformJa } from './ja'
import { platformKo } from './ko'
import { platformPtBR } from './pt-BR'
import { platformZh } from './zh'

/** Platform services such as the Android background relay notification (`src/platform/**`). */
export const platformCatalog = defineMobileCatalog({
  en: platformEn,
  zh: platformZh,
  ko: platformKo,
  ja: platformJa,
  es: platformEs,
  fr: platformFr,
  'pt-BR': platformPtBR
})
