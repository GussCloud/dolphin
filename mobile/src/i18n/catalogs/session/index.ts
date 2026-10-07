import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { sessionEn } from './en'
import { sessionEs } from './es'
import { sessionFr } from './fr'
import { sessionJa } from './ja'
import { sessionKo } from './ko'
import { sessionPtBR } from './pt-BR'
import { sessionZh } from './zh'

export type { sessionEn } from './en'

/** Session screen (`src/session/**`): tabs, terminal dock, files, markdown and quick commands. */
export const sessionCatalog = defineMobileCatalog({
  en: sessionEn,
  zh: sessionZh,
  ko: sessionKo,
  ja: sessionJa,
  es: sessionEs,
  fr: sessionFr,
  'pt-BR': sessionPtBR
})
