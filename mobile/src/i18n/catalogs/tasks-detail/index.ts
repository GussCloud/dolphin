import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { tasksDetailEn } from './en'
import { tasksDetailEs } from './es'
import { tasksDetailFr } from './fr'
import { tasksDetailJa } from './ja'
import { tasksDetailKo } from './ko'
import { tasksDetailPtBR } from './pt-BR'
import { tasksDetailZh } from './zh'

/** Task item and project detail drawers (`src/tasks/**`). */
export const tasksDetailCatalog = defineMobileCatalog({
  en: tasksDetailEn,
  zh: tasksDetailZh,
  ko: tasksDetailKo,
  ja: tasksDetailJa,
  es: tasksDetailEs,
  fr: tasksDetailFr,
  'pt-BR': tasksDetailPtBR
})
