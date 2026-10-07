import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { componentsEn } from './en'
import { componentsEs } from './es'
import { componentsFr } from './fr'
import { componentsJa } from './ja'
import { componentsKo } from './ko'
import { componentsPtBR } from './pt-BR'
import { componentsZh } from './zh'

/** Shared components in `src/components/` not covered by a `components-*` sub-namespace. */
export const componentsCatalog = defineMobileCatalog({
  en: componentsEn,
  zh: componentsZh,
  ko: componentsKo,
  ja: componentsJa,
  es: componentsEs,
  fr: componentsFr,
  'pt-BR': componentsPtBR
})
