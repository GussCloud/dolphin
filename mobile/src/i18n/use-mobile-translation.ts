import { useCallback, useSyncExternalStore } from 'react'
import type { SupportedUiLocale } from '../../../src/shared/ui-locale'
import {
  formatMobileCatalogMessage,
  type MobileCatalog,
  type MobileCatalogKey,
  type MobileCatalogSource,
  type MobileTranslate,
  type MobileTranslateArgs
} from './mobile-i18n-catalog'
import {
  getMobileLocaleSnapshot,
  subscribeMobileLocale,
  type MobileLocaleSnapshot
} from './mobile-locale-state'

/** Locale plus preference; re-renders on change. Works without the provider (tests). */
export function useMobileLocaleSnapshot(): MobileLocaleSnapshot {
  return useSyncExternalStore(
    subscribeMobileLocale,
    getMobileLocaleSnapshot,
    getMobileLocaleSnapshot
  )
}

export function useMobileLocale(): SupportedUiLocale {
  return useMobileLocaleSnapshot().locale
}

/**
 * `t` for one namespace catalog. Stable per locale, so it is safe in effect and memo deps,
 * and a language change re-renders every caller.
 */
export function useMobileTranslation<Source extends MobileCatalogSource>(
  catalog: MobileCatalog<Source>
): MobileTranslate<Source> {
  const locale = useMobileLocale()
  return useCallback(
    <Key extends MobileCatalogKey<Source>>(key: Key, ...args: MobileTranslateArgs<Source, Key>) =>
      formatMobileCatalogMessage(catalog, locale, key, args[0]),
    [catalog, locale]
  )
}
