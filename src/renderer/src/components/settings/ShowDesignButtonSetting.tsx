import type React from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'
import { getShowDesignButtonEntry } from './appearance-sidebar-search'

export function ShowDesignButtonSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const entry = getShowDesignButtonEntry()
  const visible = settings.showDesignButton !== false
  return (
    <SearchableSetting
      title={entry.title}
      description={entry.description}
      keywords={entry.keywords}
    >
      <SettingsSwitchRow
        label={entry.title}
        checked={visible}
        onChange={() => updateSettings({ showDesignButton: !visible })}
      />
    </SearchableSetting>
  )
}
