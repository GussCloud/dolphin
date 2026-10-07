import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { sessionChatEn } from './en'
import { sessionChatEs } from './es'
import { sessionChatFr } from './fr'
import { sessionChatJa } from './ja'
import { sessionChatKo } from './ko'
import { sessionChatPtBR } from './pt-BR'
import { sessionChatZh } from './zh'

export type { sessionChatEn } from './en'

/** Native chat inside a session (`src/session/**`): transcript, composer, prompts and send errors. */
export const sessionChatCatalog = defineMobileCatalog({
  en: sessionChatEn,
  zh: sessionChatZh,
  ko: sessionChatKo,
  ja: sessionChatJa,
  es: sessionChatEs,
  fr: sessionChatFr,
  'pt-BR': sessionChatPtBR
})
