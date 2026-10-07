import { defineMobileCatalog } from '../../mobile-i18n-catalog'
import { onboardingEn } from './en'
import { onboardingEs } from './es'
import { onboardingFr } from './fr'
import { onboardingJa } from './ja'
import { onboardingKo } from './ko'
import { onboardingPtBR } from './pt-BR'
import { onboardingZh } from './zh'

/** First-run onboarding (`src/onboarding/**`). */
export const onboardingCatalog = defineMobileCatalog({
  en: onboardingEn,
  zh: onboardingZh,
  ko: onboardingKo,
  ja: onboardingJa,
  es: onboardingEs,
  fr: onboardingFr,
  'pt-BR': onboardingPtBR
})
