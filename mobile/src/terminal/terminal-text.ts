import { terminalCatalog } from '../i18n/catalogs/terminal'
import type { terminalEn } from '../i18n/catalogs/terminal/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { translate } from '../i18n/mobile-locale-state'

/** Active-locale lookup for the terminal modules that run outside React. */
export const terminalText: MobileTranslate<typeof terminalEn> = (key, ...args) =>
  translate(terminalCatalog, key, ...args)
