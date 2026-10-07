import { SUPPORTED_UI_LOCALES } from '../../../src/shared/ui-locale'
import type {
  MobileCatalog,
  MobileCatalogSource,
  MobileMessageSource
} from '../i18n/mobile-i18n-catalog'

function placeholderSet(messages: readonly string[]): string {
  const names = new Set(
    messages.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
  )
  // A plural's count may be spelled out in words ("un", "一") rather than as {count}.
  names.delete('count')
  return [...names].sort().join(',')
}

function forms(message: MobileMessageSource | undefined): string[] {
  if (message === undefined) {
    return []
  }
  return typeof message === 'string' ? [message] : [message.one, message.other]
}

/**
 * `locale.key` for every translation that is empty or drops/invents a `{placeholder}`.
 * Key sets are already pinned by the locale files' types; placeholders inside strings are not.
 */
export function mobileCatalogPlaceholderMismatches<Source extends MobileCatalogSource>(
  catalog: MobileCatalog<Source>
): string[] {
  const mismatches: string[] = []
  const english: Readonly<Record<string, MobileMessageSource>> = catalog.en
  for (const locale of SUPPORTED_UI_LOCALES) {
    const localized: Readonly<Record<string, MobileMessageSource | undefined>> = catalog[locale]
    for (const [key, source] of Object.entries(english)) {
      const translated = forms(localized[key])
      const expected = placeholderSet(forms(source))
      const broken =
        translated.length === 0 ||
        translated.some((text) => text.trim() === '' || placeholderSet([text]) !== expected)
      if (broken) {
        mismatches.push(`${locale}.${key}`)
      }
    }
  }
  return mismatches
}
