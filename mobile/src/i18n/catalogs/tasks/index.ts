import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { tasksEn } from './en'
import { tasksEs } from './es'
import { tasksFr } from './fr'
import { tasksJa } from './ja'
import { tasksKo } from './ko'
import { tasksPtBR } from './pt-BR'
import { tasksZh } from './zh'

/** Tasks screen lists, pickers and create drawers (`src/tasks/**`). */
export const tasksCatalog = defineMobileCatalog({
  en: tasksEn,
  zh: tasksZh,
  ko: tasksKo,
  ja: tasksJa,
  es: tasksEs,
  fr: tasksFr,
  'pt-BR': tasksPtBR
})
