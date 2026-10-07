import {
  DEFAULT_UI_LOCALE,
  SUPPORTED_UI_LOCALES,
  normalizeSupportedUiLocale,
  resolveUiLocale,
  type SupportedUiLocale
} from '../../../src/shared/ui-locale'
import { UI_LANGUAGE_SYSTEM } from '../../../src/shared/ui-language'
import {
  formatMobileCatalogMessage,
  type MobileCatalog,
  type MobileCatalogKey,
  type MobileCatalogSource,
  type MobileTranslateArgs
} from './mobile-i18n-catalog'

/** What the Language setting stores: follow the device, or one shipped locale. */
export type MobileLanguagePreference = typeof UI_LANGUAGE_SYSTEM | SupportedUiLocale

export function isMobileLanguagePreference(value: unknown): value is MobileLanguagePreference {
  return value === UI_LANGUAGE_SYSTEM || SUPPORTED_UI_LOCALES.some((locale) => locale === value)
}

export type MobileLocaleSnapshot = {
  readonly preference: MobileLanguagePreference
  readonly locale: SupportedUiLocale
}

let systemLocaleOverride: string | null = null

/**
 * Pins what "System default" resolves to. vitest.setup.ts pins `en` so tests never follow the
 * machine's LANG; pass null to detect again.
 */
export function setMobileSystemLocaleOverride(locale: string | null): void {
  systemLocaleOverride = locale
  refreshMobileSystemLocale()
}

// Why Intl and not expo-localization: no native rebuild; Hermes resolves the device locale here.
export function detectMobileSystemLocale(): string {
  if (systemLocaleOverride !== null) {
    return systemLocaleOverride
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_UI_LOCALE
  } catch {
    return DEFAULT_UI_LOCALE
  }
}

/** The shipped locale "System default" currently resolves to. */
export function resolveMobileSystemUiLocale(): SupportedUiLocale {
  return normalizeSupportedUiLocale(detectMobileSystemLocale())
}

function resolveSnapshot(preference: MobileLanguagePreference): MobileLocaleSnapshot {
  return {
    preference,
    locale: normalizeSupportedUiLocale(resolveUiLocale(preference, detectMobileSystemLocale()))
  }
}

// Lazy so the test pin in vitest.setup.ts applies even to modules imported before it ran.
let snapshot: MobileLocaleSnapshot | null = null
const listeners = new Set<() => void>()

export function getMobileLocaleSnapshot(): MobileLocaleSnapshot {
  snapshot ??= resolveSnapshot(UI_LANGUAGE_SYSTEM)
  return snapshot
}

export function getActiveMobileLocale(): SupportedUiLocale {
  return getMobileLocaleSnapshot().locale
}

function publish(next: MobileLocaleSnapshot): void {
  const current = getMobileLocaleSnapshot()
  if (current.preference === next.preference && current.locale === next.locale) {
    return
  }
  snapshot = next
  for (const listener of listeners) {
    listener()
  }
}

/** Applies a preference in memory; persistence is `saveMobileLanguagePreference`'s job. */
export function applyMobileLanguagePreference(preference: MobileLanguagePreference): void {
  publish(resolveSnapshot(preference))
}

/** Re-reads the device locale, for when the app returns from the system settings. */
export function refreshMobileSystemLocale(): void {
  publish(resolveSnapshot(getMobileLocaleSnapshot().preference))
}

export function subscribeMobileLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Non-React lookup in the active locale, for alerts, notifications and operations modules.
 * Call it when the string is shown, never at module scope, or the first locale is frozen in.
 */
export function translate<Source extends MobileCatalogSource, Key extends MobileCatalogKey<Source>>(
  catalog: MobileCatalog<Source>,
  key: Key,
  ...args: MobileTranslateArgs<Source, Key>
): string {
  return formatMobileCatalogMessage(catalog, getActiveMobileLocale(), key, args[0])
}
