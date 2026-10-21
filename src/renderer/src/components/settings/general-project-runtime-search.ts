import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translateSearchKeyword } from './settings-search-keywords'

export const getWslConfigTuningSearchEntry = createLocalizedCatalog(() => ({
  title: translate('auto.components.settings.general.search.wslMemoryTuning', 'WSL Memory Tuning'),
  description: translate(
    'auto.components.settings.general.search.wslMemoryTuningDescription',
    'Suggest .wslconfig settings that return idle WSL and Docker memory to Windows.'
  ),
  keywords: [
    ...translateSearchKeyword('auto.components.settings.general.search.wslconfig', 'wslconfig'),
    ...translateSearchKeyword('auto.components.settings.general.search.memory', 'memory'),
    ...translateSearchKeyword('auto.components.settings.general.search.docker', 'docker'),
    ...translateSearchKeyword('auto.components.settings.general.search.wsl', 'wsl')
  ]
}))

export const getGeneralProjectRuntimeSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate(
      'auto.components.settings.general.search.defaultProjectRuntime',
      'Default Project Runtime'
    ),
    description: translate(
      'auto.components.settings.general.search.defaultProjectRuntimeDescription',
      'Choose the runtime inherited by local Windows projects.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.general.search.projectRuntime',
        'project runtime'
      ),
      ...translateSearchKeyword('auto.components.settings.general.search.runtime', 'runtime'),
      ...translateSearchKeyword(
        'auto.components.settings.general.search.windowsHost',
        'windows host'
      ),
      ...translateSearchKeyword('auto.components.settings.general.search.wsl', 'wsl'),
      ...translateSearchKeyword('auto.components.settings.general.search.distro', 'distro'),
      ...translateSearchKeyword('auto.components.settings.general.search.execution', 'execution')
    ]
  },
  getWslConfigTuningSearchEntry()
])
