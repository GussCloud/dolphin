import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { notificationsEn } from './en'
import { notificationsEs } from './es'
import { notificationsFr } from './fr'
import { notificationsJa } from './ja'
import { notificationsKo } from './ko'
import { notificationsPtBR } from './pt-BR'
import { notificationsZh } from './zh'

/** Notification delivery settings and Android channels (`src/notifications/**`). */
export const notificationsCatalog = defineMobileCatalog({
  en: notificationsEn,
  zh: notificationsZh,
  ko: notificationsKo,
  ja: notificationsJa,
  es: notificationsEs,
  fr: notificationsFr,
  'pt-BR': notificationsPtBR
})
