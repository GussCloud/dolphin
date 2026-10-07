import { SUPPORTED_UI_LOCALES, type SupportedUiLocale } from '../../../src/shared/ui-locale'

// Endonyms, never translated: a reader lost in a foreign UI must still find their language.
// Matches the desktop's language picker labels.
export const MOBILE_LANGUAGE_ENDONYMS: Readonly<Record<SupportedUiLocale, string>> = {
  en: 'English',
  zh: '中文（简体）',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  fr: 'Français',
  'pt-BR': 'Português (Brasil)'
}

export const MOBILE_LANGUAGE_LOCALES: readonly SupportedUiLocale[] = SUPPORTED_UI_LOCALES
