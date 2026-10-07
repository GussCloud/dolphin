import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { appRoutesEn } from './en'
import { appRoutesEs } from './es'
import { appRoutesFr } from './fr'
import { appRoutesJa } from './ja'
import { appRoutesKo } from './ko'
import { appRoutesPtBR } from './pt-BR'
import { appRoutesZh } from './zh'

/** Pairing and onboarding routes in `app/*.tsx`; settings routes use `settingsCatalog`. */
export const appRoutesCatalog = defineMobileCatalog({
  en: appRoutesEn,
  zh: appRoutesZh,
  ko: appRoutesKo,
  ja: appRoutesJa,
  es: appRoutesEs,
  fr: appRoutesFr,
  'pt-BR': appRoutesPtBR
})
