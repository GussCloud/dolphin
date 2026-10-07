import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { homeEn } from './en'
import { homeEs } from './es'
import { homeFr } from './fr'
import { homeJa } from './ja'
import { homeKo } from './ko'
import { homePtBR } from './pt-BR'
import { homeZh } from './zh'

/** Home screen (`src/home/**`). */
export const homeCatalog = defineMobileCatalog({
  en: homeEn,
  zh: homeZh,
  ko: homeKo,
  ja: homeJa,
  es: homeEs,
  fr: homeFr,
  'pt-BR': homePtBR
})
