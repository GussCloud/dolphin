import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { sourceControlEn } from './en'
import { sourceControlEs } from './es'
import { sourceControlFr } from './fr'
import { sourceControlJa } from './ja'
import { sourceControlKo } from './ko'
import { sourceControlPtBR } from './pt-BR'
import { sourceControlZh } from './zh'

/** Source Control hub (`src/source-control/**`). */
export const sourceControlCatalog = defineMobileCatalog({
  en: sourceControlEn,
  zh: sourceControlZh,
  ko: sourceControlKo,
  ja: sourceControlJa,
  es: sourceControlEs,
  fr: sourceControlFr,
  'pt-BR': sourceControlPtBR
})
