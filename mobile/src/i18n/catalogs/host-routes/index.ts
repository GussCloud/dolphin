import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { hostRoutesEn } from './en'
import { hostRoutesEs } from './es'
import { hostRoutesFr } from './fr'
import { hostRoutesJa } from './ja'
import { hostRoutesKo } from './ko'
import { hostRoutesPtBR } from './pt-BR'
import { hostRoutesZh } from './zh'

/** Host routes (`app/h/**`): route titles, edit host and accounts. */
export const hostRoutesCatalog = defineMobileCatalog({
  en: hostRoutesEn,
  zh: hostRoutesZh,
  ko: hostRoutesKo,
  ja: hostRoutesJa,
  es: hostRoutesEs,
  fr: hostRoutesFr,
  'pt-BR': hostRoutesPtBR
})
