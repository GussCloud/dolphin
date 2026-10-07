import type { SupportedUiLocale } from '../../../src/shared/ui-locale'
import {
  interpolateMobileMessage,
  mobilePluralCategory,
  type MobileMessageVars,
  type MobilePluralMessage
} from './mobile-message-format'

export type { MobileMessageVars, MobilePluralMessage } from './mobile-message-format'

export type MobileMessageSource = string | MobilePluralMessage

/** The shape an `en.ts` namespace file satisfies; declare it `as const` so placeholders are typed. */
export type MobileCatalogSource = Readonly<Record<string, MobileMessageSource>>

/** A non-English locale file: exactly the English keys, so a missing or extra key fails `tsc`. */
export type MobileLocaleMessages<Source extends MobileCatalogSource> = {
  readonly [Key in keyof Source]: Source[Key] extends string ? string : MobilePluralMessage
}

export type MobileCatalog<Source extends MobileCatalogSource> = { readonly en: Source } & Readonly<
  Record<Exclude<SupportedUiLocale, 'en'>, MobileLocaleMessages<Source>>
>

export type MobileCatalogKey<Source extends MobileCatalogSource> = keyof Source & string

type PlaceholderNames<Template extends string> = string extends Template
  ? string
  : Template extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholderNames<Rest>
    : never

type PlaceholderVars<Names extends string> = Readonly<Record<Names, string | number>>

type MessageArgs<Message> = Message extends MobilePluralMessage
  ? [
      vars: { readonly count: number } & PlaceholderVars<
        Exclude<PlaceholderNames<Message['one'] | Message['other']>, 'count'>
      >
    ]
  : Message extends string
    ? [PlaceholderNames<Message>] extends [never]
      ? []
      : [vars: PlaceholderVars<PlaceholderNames<Message>>]
    : never

/** Vars are required exactly when the English message has `{placeholders}` or is a plural. */
export type MobileTranslateArgs<
  Source extends MobileCatalogSource,
  Key extends MobileCatalogKey<Source>
> = MessageArgs<Source[Key]>

export type MobileTranslate<Source extends MobileCatalogSource> = <
  Key extends MobileCatalogKey<Source>
>(
  key: Key,
  ...args: MobileTranslateArgs<Source, Key>
) => string

/** Binds a namespace's locale files; the `en` argument is the type every other locale is held to. */
export function defineMobileCatalog<Source extends MobileCatalogSource>(
  catalog: MobileCatalog<Source>
): MobileCatalog<Source> {
  return catalog
}

export function formatMobileCatalogMessage<Source extends MobileCatalogSource>(
  catalog: MobileCatalog<Source>,
  locale: SupportedUiLocale,
  key: MobileCatalogKey<Source>,
  vars?: MobileMessageVars
): string {
  const localized: Readonly<Record<string, MobileMessageSource | undefined>> = catalog[locale]
  const english: Readonly<Record<string, MobileMessageSource | undefined>> = catalog.en
  // Why: types guarantee completeness, but a hot-reloaded or hand-built catalog may not.
  const message = localized[key] ?? english[key]
  if (message === undefined) {
    return key
  }
  if (typeof message === 'string') {
    return interpolateMobileMessage(message, vars)
  }
  const count = typeof vars?.count === 'number' ? vars.count : Number.NaN
  return interpolateMobileMessage(message[mobilePluralCategory(locale, count)], vars)
}
