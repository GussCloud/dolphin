import type { SupportedUiLocale } from '../../../src/shared/ui-locale'

/** A count-dependent message; selected with `vars.count` like desktop i18next's `key_one`/`key_other`. */
export type MobilePluralMessage = { readonly one: string; readonly other: string }

export type MobileMessageVars = Readonly<Record<string, string | number>>

/**
 * CLDR one/other for the shipped locales, written out because Hermes has no Intl.PluralRules.
 * Categories beyond one/other (es/fr/pt "many") fall to other, as i18next does without a key.
 */
export function mobilePluralCategory(locale: SupportedUiLocale, count: number): 'one' | 'other' {
  if (!Number.isFinite(count)) {
    return 'other'
  }
  const magnitude = Math.abs(count)
  switch (locale) {
    case 'zh':
    case 'ja':
    case 'ko':
      return 'other'
    case 'fr':
    case 'pt-BR':
      // CLDR `i = 0..1`: 0 and 1.5 are singular in French and Portuguese.
      return Math.trunc(magnitude) <= 1 ? 'one' : 'other'
    case 'en':
    case 'es':
      return magnitude === 1 ? 'one' : 'other'
  }
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Replaces `{name}` with `vars.name`; an unknown name stays visible so a missing var is noticed. */
export function interpolateMobileMessage(template: string, vars?: MobileMessageVars): string {
  if (!vars) {
    return template
  }
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = Object.hasOwn(vars, name) ? vars[name] : undefined
    return value === undefined ? match : String(value)
  })
}
