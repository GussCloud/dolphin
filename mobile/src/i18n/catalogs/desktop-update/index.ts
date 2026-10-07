import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { desktopUpdateEn } from './en'
import { desktopUpdateEs } from './es'
import { desktopUpdateFr } from './fr'
import { desktopUpdateJa } from './ja'
import { desktopUpdateKo } from './ko'
import { desktopUpdatePtBR } from './pt-BR'
import { desktopUpdateZh } from './zh'

/** Desktop update offers on host cards (`src/desktop-update/**`). */
export const desktopUpdateCatalog = defineMobileCatalog({
  en: desktopUpdateEn,
  zh: desktopUpdateZh,
  ko: desktopUpdateKo,
  ja: desktopUpdateJa,
  es: desktopUpdateEs,
  fr: desktopUpdateFr,
  'pt-BR': desktopUpdatePtBR
})
