import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { dictationEn } from './en'
import { dictationEs } from './es'
import { dictationFr } from './fr'
import { dictationJa } from './ja'
import { dictationKo } from './ko'
import { dictationPtBR } from './pt-BR'
import { dictationZh } from './zh'

/** Voice dictation setup and microphone errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`). */
export const dictationCatalog = defineMobileCatalog({
  en: dictationEn,
  zh: dictationZh,
  ko: dictationKo,
  ja: dictationJa,
  es: dictationEs,
  fr: dictationFr,
  'pt-BR': dictationPtBR
})
