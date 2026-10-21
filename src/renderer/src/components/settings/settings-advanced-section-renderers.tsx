import { lazy, Suspense } from 'react'
import { AdvancedPane } from './AdvancedPane'
import { ExperimentalPane } from './ExperimentalPane'
import { PerformancePane } from './PerformancePane'
import { PluginsSettingsSection } from './PluginsSettingsSection'
import { SettingsSection } from './SettingsSection'
import { translate } from '@/i18n/i18n'
import type { SettingsRenderContext } from './settings-render-context'

const DevToolsPane = import.meta.env.DEV
  ? lazy(() => import('./DevToolsPane').then((module) => ({ default: module.DevToolsPane })))
  : null

export function renderAdvancedSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { model, navigation, view } = context
  return model.showDesktopOnlySettings ? (
    <SettingsSection
      id="advanced"
      title={translate('auto.components.settings.Settings.1c87f8d024', 'Advanced')}
      description={translate(
        'auto.components.settings.Settings.499c1cd7f9',
        'Low-level compatibility settings for troubleshooting.'
      )}
      searchEntries={navigation.getSectionSearchEntries('advanced')}
    >
      {view.isSectionMounted('advanced') ? (
        <AdvancedPane settings={model.settings} updateSettings={model.updateSettings} />
      ) : null}
    </SettingsSection>
  ) : null
}

// Why: visibility follows the nav metadata so the pane and sidebar row cannot drift.
export function renderPerformanceSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { navigation, view } = context
  return navigation.navSections.some((section) => section.id === 'performance') ? (
    <SettingsSection
      id="performance"
      title={translate('auto.components.settings.Settings.performance', 'Performance')}
      description={translate(
        'auto.components.settings.Settings.performanceDescription',
        'Analyze this machine and suggest settings that keep it responsive.'
      )}
      searchEntries={navigation.getSectionSearchEntries('performance')}
    >
      {view.isSectionMounted('performance') ? <PerformancePane /> : null}
    </SettingsSection>
  ) : null
}

export function renderDevSettingsSection(context: SettingsRenderContext): React.JSX.Element | null {
  const { model, navigation, view } = context
  return model.showDesktopOnlySettings && import.meta.env.DEV ? (
    <SettingsSection
      id="dev"
      title={translate('auto.components.settings.Settings.dev', 'Dev Tools')}
      description={translate(
        'auto.components.settings.Settings.devDescription',
        'Dev-only tools for exercising UI states.'
      )}
      searchEntries={navigation.getSectionSearchEntries('dev')}
    >
      {DevToolsPane && view.isSectionMounted('dev') ? (
        <Suspense fallback={null}>
          <DevToolsPane />
        </Suspense>
      ) : null}
    </SettingsSection>
  ) : null
}

export function renderExperimentalSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element {
  const { model, navigation, view } = context
  return (
    <SettingsSection
      id="experimental"
      title={translate('auto.components.settings.Settings.8b017f2506', 'Experimental')}
      description={translate(
        'auto.components.settings.Settings.075341c763',
        'New features that are still taking shape. Give them a try.'
      )}
      searchEntries={navigation.getSectionSearchEntries('experimental')}
      // Why: Option-click the page title unlocks the hidden staff group
      // (session-only) — same idiom as Option-click on the Updates header.
      onTitleClick={(event) => {
        if (event.altKey) {
          model.setHiddenExperimentalUnlocked((previous) => !previous)
        }
      }}
    >
      {view.isSectionMounted('experimental') ? (
        <ExperimentalPane
          settings={model.settings}
          updateSettings={model.updateSettings}
          hiddenExperimentalUnlocked={model.hiddenExperimentalUnlocked}
        />
      ) : null}
    </SettingsSection>
  )
}

export function renderPluginsSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { model, view } = context
  return model.showDesktopOnlySettings ? (
    <PluginsSettingsSection
      mounted={view.isSectionMounted('plugins')}
      settings={model.settings}
      updateSettings={model.updateSettingsOrThrow}
    />
  ) : null
}
