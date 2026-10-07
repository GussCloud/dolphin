import { filesCatalog } from '../i18n/catalogs/files'
import type { filesEn } from '../i18n/catalogs/files/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { translate } from '../i18n/mobile-locale-state'

/** Active-locale lookup for the file modules that run outside React. */
export const filesText: MobileTranslate<typeof filesEn> = (key, ...args) =>
  translate(filesCatalog, key, ...args)
