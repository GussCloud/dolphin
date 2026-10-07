import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { settingsEn } from './en'
import { settingsEs } from './es'
import { settingsFr } from './fr'
import { settingsJa } from './ja'
import { settingsKo } from './ko'
import { settingsPtBR } from './pt-BR'
import { settingsZh } from './zh'

/** Settings screens (`src/settings/**`) and the settings routes in `app/`. */
export const settingsCatalog = defineMobileCatalog({
  en: settingsEn,
  zh: settingsZh,
  ko: settingsKo,
  ja: settingsJa,
  es: settingsEs,
  fr: settingsFr,
  'pt-BR': settingsPtBR
})
