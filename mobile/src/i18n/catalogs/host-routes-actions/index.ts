import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { hostRoutesActionsEn } from './en'
import { hostRoutesActionsEs } from './es'
import { hostRoutesActionsFr } from './fr'
import { hostRoutesActionsJa } from './ja'
import { hostRoutesActionsKo } from './ko'
import { hostRoutesActionsPtBR } from './pt-BR'
import { hostRoutesActionsZh } from './zh'

/** Loose host route and host action modules directly in `src/`. */
export const hostRoutesActionsCatalog = defineMobileCatalog({
  en: hostRoutesActionsEn,
  zh: hostRoutesActionsZh,
  ko: hostRoutesActionsKo,
  ja: hostRoutesActionsJa,
  es: hostRoutesActionsEs,
  fr: hostRoutesActionsFr,
  'pt-BR': hostRoutesActionsPtBR
})
