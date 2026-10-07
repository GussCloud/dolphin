import { transportCatalog } from '../i18n/catalogs/transport'
import type { transportEn } from '../i18n/catalogs/transport/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { translate } from '../i18n/mobile-locale-state'

/** Active-locale lookup for the transport modules, none of which run inside React. */
export const transportText: MobileTranslate<typeof transportEn> = (key, ...args) =>
  translate(transportCatalog, key, ...args)
