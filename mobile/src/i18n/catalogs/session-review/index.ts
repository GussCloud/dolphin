import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { sessionReviewEn } from './en'
import { sessionReviewEs } from './es'
import { sessionReviewFr } from './fr'
import { sessionReviewJa } from './ja'
import { sessionReviewKo } from './ko'
import { sessionReviewPtBR } from './pt-BR'
import { sessionReviewZh } from './zh'

export type { sessionReviewEn } from './en'

/** Diff review, pull request and agent-resume flows driven from `src/session/**`. */
export const sessionReviewCatalog = defineMobileCatalog({
  en: sessionReviewEn,
  zh: sessionReviewZh,
  ko: sessionReviewKo,
  ja: sessionReviewJa,
  es: sessionReviewEs,
  fr: sessionReviewFr,
  'pt-BR': sessionReviewPtBR
})
