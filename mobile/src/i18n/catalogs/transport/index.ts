import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { transportEn } from './en'
import { transportEs } from './es'
import { transportFr } from './fr'
import { transportJa } from './ja'
import { transportKo } from './ko'
import { transportPtBR } from './pt-BR'
import { transportZh } from './zh'

/** Connection status, host addresses and pairing (`src/transport/**`). */
export const transportCatalog = defineMobileCatalog({
  en: transportEn,
  zh: transportZh,
  ko: transportKo,
  ja: transportJa,
  es: transportEs,
  fr: transportFr,
  'pt-BR': transportPtBR
})
