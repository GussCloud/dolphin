import { sourceControlCatalog } from '../i18n/catalogs/source-control'
import type { sourceControlEn } from '../i18n/catalogs/source-control/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { translate } from '../i18n/mobile-locale-state'

/** Active-locale lookup for the source-control modules that run outside React. */
export const sourceControlText: MobileTranslate<typeof sourceControlEn> = (key, ...args) =>
  translate(sourceControlCatalog, key, ...args)
