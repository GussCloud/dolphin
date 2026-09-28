import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getDolphinAccountSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.dolphinAccount.account', 'Dolphin account'),
    description: translate(
      'auto.components.settings.dolphinAccount.searchDescription',
      'Sign in or out of the account used by Artifacts and Dolphin Relay.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.dolphinAccount.keywordAccount',
        'account'
      ),
      ...translateSearchKeyword('auto.components.settings.dolphinAccount.keywordLogin', 'login'),
      ...translateSearchKeyword('auto.components.settings.dolphinAccount.keywordLogout', 'logout'),
      ...translateSearchKeyword('auto.components.settings.dolphinAccount.keywordSignIn', 'sign in'),
      ...translateSearchKeyword(
        'auto.components.settings.dolphinAccount.keywordSignOut',
        'sign out'
      ),
      ...translateSearchKeyword('auto.components.settings.dolphinAccount.keywordRelay', 'relay'),
      ...translateSearchKeyword('auto.components.settings.dolphinAccount.keywordCloud', 'cloud')
    ]
  }
])
