import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { diagnosticsEn } from './en'
import { diagnosticsEs } from './es'
import { diagnosticsFr } from './fr'
import { diagnosticsJa } from './ja'
import { diagnosticsKo } from './ko'
import { diagnosticsPtBR } from './pt-BR'
import { diagnosticsZh } from './zh'

/** Troubleshooting and network diagnostics screens (`src/diagnostics/**`). Shared crash reports stay English. */
export const diagnosticsCatalog = defineMobileCatalog({
  en: diagnosticsEn,
  zh: diagnosticsZh,
  ko: diagnosticsKo,
  ja: diagnosticsJa,
  es: diagnosticsEs,
  fr: diagnosticsFr,
  'pt-BR': diagnosticsPtBR
})
