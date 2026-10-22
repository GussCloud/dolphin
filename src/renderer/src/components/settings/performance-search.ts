import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import type { SettingsSearchEntry } from './settings-search'
import { translateSearchKeyword } from './settings-search-keywords'

export const getWslConfigTuningSearchEntry = createLocalizedCatalog((): SettingsSearchEntry => ({
  title: translate('auto.components.settings.performance.search.wslMemory', 'WSL Memory'),
  description: translate(
    'auto.components.settings.performance.search.wslMemoryDescription',
    'Suggest .wslconfig settings that return idle WSL and Docker memory to Windows.'
  ),
  keywords: [
    ...translateSearchKeyword('auto.components.settings.performance.search.wslconfig', 'wslconfig'),
    ...translateSearchKeyword('auto.components.settings.performance.search.wsl', 'wsl'),
    ...translateSearchKeyword('auto.components.settings.performance.search.memory', 'memory'),
    ...translateSearchKeyword('auto.components.settings.performance.search.docker', 'docker'),
    ...translateSearchKeyword('auto.components.settings.performance.search.slow', 'slow')
  ]
}))

export const getPerformancePaneSearchEntries = createLocalizedCatalog((): SettingsSearchEntry[] => [
  getWslConfigTuningSearchEntry()
])
