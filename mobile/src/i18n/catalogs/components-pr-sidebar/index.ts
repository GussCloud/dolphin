import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { componentsPrSidebarEn } from './en'
import { componentsPrSidebarEs } from './es'
import { componentsPrSidebarFr } from './fr'
import { componentsPrSidebarJa } from './ja'
import { componentsPrSidebarKo } from './ko'
import { componentsPrSidebarPtBR } from './pt-BR'
import { componentsPrSidebarZh } from './zh'

/** Pull request sidebar (`src/components/pr-sidebar/**`, `MobilePRSidebar.tsx`). */
export const componentsPrSidebarCatalog = defineMobileCatalog({
  en: componentsPrSidebarEn,
  zh: componentsPrSidebarZh,
  ko: componentsPrSidebarKo,
  ja: componentsPrSidebarJa,
  es: componentsPrSidebarEs,
  fr: componentsPrSidebarFr,
  'pt-BR': componentsPrSidebarPtBR
})
