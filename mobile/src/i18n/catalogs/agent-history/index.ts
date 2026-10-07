import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { agentHistoryEn } from './en'
import { agentHistoryEs } from './es'
import { agentHistoryFr } from './fr'
import { agentHistoryJa } from './ja'
import { agentHistoryKo } from './ko'
import { agentHistoryPtBR } from './pt-BR'
import { agentHistoryZh } from './zh'

/** Agent session history (`src/agent-history/**`). */
export const agentHistoryCatalog = defineMobileCatalog({
  en: agentHistoryEn,
  zh: agentHistoryZh,
  ko: agentHistoryKo,
  ja: agentHistoryJa,
  es: agentHistoryEs,
  fr: agentHistoryFr,
  'pt-BR': agentHistoryPtBR
})
