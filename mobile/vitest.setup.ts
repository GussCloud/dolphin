import { setMobileSystemLocaleOverride } from './src/i18n/mobile-locale-state'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
// Why: Node's Intl follows the machine's LANG; tests assert English copy.
setMobileSystemLocaleOverride('en')
