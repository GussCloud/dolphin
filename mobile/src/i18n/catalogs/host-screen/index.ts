import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { hostScreenEn } from './en'
import { hostScreenEs } from './es'
import { hostScreenFr } from './fr'
import { hostScreenJa } from './ja'
import { hostScreenKo } from './ko'
import { hostScreenPtBR } from './pt-BR'
import { hostScreenZh } from './zh'

/** Host screen: workspace list, toolbar and host actions (`src/host-screen/**`). */
export const hostScreenCatalog = defineMobileCatalog({
  en: hostScreenEn,
  zh: hostScreenZh,
  ko: hostScreenKo,
  ja: hostScreenJa,
  es: hostScreenEs,
  fr: hostScreenFr,
  'pt-BR': hostScreenPtBR
})
