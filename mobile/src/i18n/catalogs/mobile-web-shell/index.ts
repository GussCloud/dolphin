import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { mobileWebShellEn } from './en'
import { mobileWebShellEs } from './es'
import { mobileWebShellFr } from './fr'
import { mobileWebShellJa } from './ja'
import { mobileWebShellKo } from './ko'
import { mobileWebShellPtBR } from './pt-BR'
import { mobileWebShellZh } from './zh'

/** Hybrid web shell screens (`src/mobile-web-shell/**`). */
export const mobileWebShellCatalog = defineMobileCatalog({
  en: mobileWebShellEn,
  zh: mobileWebShellZh,
  ko: mobileWebShellKo,
  ja: mobileWebShellJa,
  es: mobileWebShellEs,
  fr: mobileWebShellFr,
  'pt-BR': mobileWebShellPtBR
})
