import { afterEach, describe, expect, it } from 'vitest'
import { SUPPORTED_UI_LOCALES } from '../../../src/shared/ui-locale'
import { mobileCatalogPlaceholderMismatches } from '../test-support/mobile-catalog-placeholders'
import {
  defineMobileCatalog,
  formatMobileCatalogMessage,
  type MobileCatalogSource,
  type MobileLocaleMessages
} from './mobile-i18n-catalog'
import { interpolateMobileMessage, mobilePluralCategory } from './mobile-message-format'
import {
  applyMobileLanguagePreference,
  detectMobileSystemLocale,
  getActiveMobileLocale,
  isMobileLanguagePreference,
  setMobileSystemLocaleOverride,
  subscribeMobileLocale,
  translate
} from './mobile-locale-state'

const probeEn = {
  plain: 'Hello',
  greeting: 'Hello {name}',
  items: { one: '{count} item in {place}', other: '{count} items in {place}' }
} as const satisfies MobileCatalogSource

const probePt: MobileLocaleMessages<typeof probeEn> = {
  plain: 'Olá',
  greeting: 'Olá {name}',
  items: { one: '{count} item em {place}', other: '{count} itens em {place}' }
}

const probeCatalog = defineMobileCatalog({
  en: probeEn,
  zh: { plain: '你好', greeting: '你好 {name}', items: { one: '{count} 项', other: '{count} 项' } },
  ko: probeEn,
  ja: probeEn,
  es: probeEn,
  fr: probeEn,
  'pt-BR': probePt
})

afterEach(() => {
  applyMobileLanguagePreference('system')
  setMobileSystemLocaleOverride('en')
})

describe('locale resolution', () => {
  it('defaults to English under test, whatever the machine locale', () => {
    expect(detectMobileSystemLocale()).toBe('en')
    expect(getActiveMobileLocale()).toBe('en')
  })

  it('reads a real locale from Intl when nothing is pinned', () => {
    setMobileSystemLocaleOverride(null)
    expect(detectMobileSystemLocale()).toBe(Intl.DateTimeFormat().resolvedOptions().locale)
  })

  it.each([
    ['pt-BR', 'pt-BR'],
    ['pt_BR', 'pt-BR'],
    ['pt-PT', 'en'],
    ['zh-Hans-CN', 'zh'],
    ['zh-TW', 'en'],
    ['ja-JP', 'ja'],
    ['fr-CA', 'fr'],
    ['de-DE', 'en'],
    ['', 'en']
  ])('maps system locale %s to %s', (system, expected) => {
    setMobileSystemLocaleOverride(system)
    expect(getActiveMobileLocale()).toBe(expected)
  })

  it('lets an explicit preference win over the system locale', () => {
    setMobileSystemLocaleOverride('ja-JP')
    applyMobileLanguagePreference('pt-BR')
    expect(getActiveMobileLocale()).toBe('pt-BR')
    applyMobileLanguagePreference('system')
    expect(getActiveMobileLocale()).toBe('ja')
  })

  it('notifies subscribers only when the resolved state changes', () => {
    let calls = 0
    const unsubscribe = subscribeMobileLocale(() => {
      calls += 1
    })
    applyMobileLanguagePreference('es')
    applyMobileLanguagePreference('es')
    unsubscribe()
    applyMobileLanguagePreference('fr')
    expect(calls).toBe(1)
  })

  it('accepts only system and shipped locales as a stored preference', () => {
    expect(isMobileLanguagePreference('system')).toBe(true)
    expect(isMobileLanguagePreference('pt-BR')).toBe(true)
    expect(isMobileLanguagePreference('pt')).toBe(false)
    expect(isMobileLanguagePreference('plugin:acme.pack/de')).toBe(false)
    expect(isMobileLanguagePreference(null)).toBe(false)
  })
})

describe('message formatting', () => {
  it('interpolates named placeholders and leaves unknown ones visible', () => {
    expect(
      interpolateMobileMessage('Restore {host} in {seconds}s', { host: 'mac', seconds: 5 })
    ).toBe('Restore mac in 5s')
    expect(interpolateMobileMessage('Hi {name}', {})).toBe('Hi {name}')
    expect(interpolateMobileMessage('Hi {constructor}', {})).toBe('Hi {constructor}')
  })

  it('selects plural categories with CLDR one/other rules', () => {
    expect(mobilePluralCategory('en', 1)).toBe('one')
    expect(mobilePluralCategory('en', 0)).toBe('other')
    expect(mobilePluralCategory('es', 1)).toBe('one')
    expect(mobilePluralCategory('es', 2)).toBe('other')
    // French and Portuguese treat 0 as singular, like i18next via Intl.PluralRules.
    expect(mobilePluralCategory('fr', 0)).toBe('one')
    expect(mobilePluralCategory('pt-BR', 0)).toBe('one')
    expect(mobilePluralCategory('pt-BR', 2)).toBe('other')
    expect(mobilePluralCategory('ja', 1)).toBe('other')
    expect(mobilePluralCategory('en', Number.NaN)).toBe('other')
  })

  it('matches Intl.PluralRules for the one/other split in every shipped locale', () => {
    for (const locale of SUPPORTED_UI_LOCALES) {
      const rules = new Intl.PluralRules(locale)
      for (const count of [0, 1, 2, 5, 21, 100]) {
        const expected = rules.select(count) === 'one' ? 'one' : 'other'
        expect(mobilePluralCategory(locale, count), `${locale} ${count}`).toBe(expected)
      }
    }
  })

  it('formats plurals in the requested locale', () => {
    expect(
      formatMobileCatalogMessage(probeCatalog, 'en', 'items', { count: 1, place: 'box' })
    ).toBe('1 item in box')
    expect(
      formatMobileCatalogMessage(probeCatalog, 'pt-BR', 'items', { count: 3, place: 'caixa' })
    ).toBe('3 itens em caixa')
  })

  it('falls back to English, then to the key, for a hand-built incomplete catalog', () => {
    const english: Record<string, string> = { plain: 'Hello', greeting: 'Hello {name}' }
    const loose = defineMobileCatalog<Record<string, string>>({
      en: english,
      zh: english,
      ko: english,
      ja: english,
      es: english,
      fr: english,
      'pt-BR': { plain: 'Olá' }
    })
    expect(formatMobileCatalogMessage(loose, 'pt-BR', 'greeting', { name: 'Ana' })).toBe(
      'Hello Ana'
    )
    expect(formatMobileCatalogMessage(loose, 'pt-BR', 'missing', {})).toBe('missing')
  })

  it('translate() reads the active locale at call time', () => {
    expect(translate(probeCatalog, 'greeting', { name: 'Ana' })).toBe('Hello Ana')
    applyMobileLanguagePreference('pt-BR')
    expect(translate(probeCatalog, 'greeting', { name: 'Ana' })).toBe('Olá Ana')
  })
})

describe('placeholder check', () => {
  it('flags a translation that drops or invents a placeholder', () => {
    const english: Record<string, string> = { greeting: 'Hello {name}', plain: 'Hi' }
    const catalog = defineMobileCatalog<Record<string, string>>({
      en: english,
      zh: english,
      ko: english,
      ja: { greeting: 'こんにちは', plain: 'やあ' },
      es: english,
      fr: { greeting: 'Bonjour {nom}', plain: '' },
      'pt-BR': english
    })
    expect(mobileCatalogPlaceholderMismatches(catalog)).toEqual([
      'ja.greeting',
      'fr.greeting',
      'fr.plain'
    ])
  })
})

// Compile-time completeness: these must fail `tsc -p tsconfig.test.json` if the type loosens.
export const typeChecks = [
  // @ts-expect-error a locale missing a key
  ((): MobileLocaleMessages<typeof probeEn> => ({ plain: 'x', greeting: 'x {name}' }))(),
  ((): MobileLocaleMessages<typeof probeEn> => ({
    plain: 'x',
    greeting: 'x',
    items: { one: 'x', other: 'x' },
    // @ts-expect-error a locale with an extra key
    extra: 'x'
  }))(),
  // @ts-expect-error placeholders make vars required
  () => translate(probeCatalog, 'greeting'),
  // @ts-expect-error a plural requires count
  () => translate(probeCatalog, 'items', { place: 'x' }),
  // @ts-expect-error unknown key
  () => translate(probeCatalog, 'nope')
]
