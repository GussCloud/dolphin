import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { filesEn } from './en'
import { filesEs } from './es'
import { filesFr } from './fr'
import { filesJa } from './ja'
import { filesKo } from './ko'
import { filesPtBR } from './pt-BR'
import { filesZh } from './zh'

/** File explorer and file preview (`src/files/**`). */
export const filesCatalog = defineMobileCatalog({
  en: filesEn,
  zh: filesZh,
  ko: filesKo,
  ja: filesJa,
  es: filesEs,
  fr: filesFr,
  'pt-BR': filesPtBR
})
