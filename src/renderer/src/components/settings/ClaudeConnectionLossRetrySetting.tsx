import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  getClaudeConnectionLossRetryDescription,
  getClaudeConnectionLossRetryTitle
} from './claude-connection-loss-retry-copy'
import { SettingsSwitchRow } from './SettingsFormControls'

type ClaudeConnectionLossRetrySettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

export function ClaudeConnectionLossRetrySetting({
  settings,
  updateSettings
}: ClaudeConnectionLossRetrySettingProps) {
  const enabled = settings.claudeAutoRetryOnConnectionLoss !== false
  return (
    <section className="space-y-3">
      <SettingsSwitchRow
        label={getClaudeConnectionLossRetryTitle()}
        description={getClaudeConnectionLossRetryDescription()}
        checked={enabled}
        onChange={() => updateSettings({ claudeAutoRetryOnConnectionLoss: !enabled })}
        ariaLabel={getClaudeConnectionLossRetryTitle()}
      />
    </section>
  )
}
