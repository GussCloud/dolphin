import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { componentsDiffReviewEn } from './en'
import { componentsDiffReviewEs } from './es'
import { componentsDiffReviewFr } from './fr'
import { componentsDiffReviewJa } from './ja'
import { componentsDiffReviewKo } from './ko'
import { componentsDiffReviewPtBR } from './pt-BR'
import { componentsDiffReviewZh } from './zh'

/** Diff review screen (`src/components/MobileDiffReview*`). */
export const componentsDiffReviewCatalog = defineMobileCatalog({
  en: componentsDiffReviewEn,
  zh: componentsDiffReviewZh,
  ko: componentsDiffReviewKo,
  ja: componentsDiffReviewJa,
  es: componentsDiffReviewEs,
  fr: componentsDiffReviewFr,
  'pt-BR': componentsDiffReviewPtBR
})
