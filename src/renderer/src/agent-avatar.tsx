import './assets/main.css'

import { StrictMode, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentInteractionAvatar } from './components/agent-interaction-avatar/AgentInteractionAvatar'
import { I18nProvider } from './i18n/I18nProvider'
import { applyDocumentTheme } from './lib/document-theme'
import { buildAppFontFamily } from './lib/app-font-family'
import { getOrCreateRendererRoot } from './lib/react-renderer-root'
import { useAppStore } from './store'
import type { GlobalSettings } from '../../shared/global-settings-types'

// Why its own entry: the avatar is a separate always-on-top window; it shares the preload and
// runs no periodic diagnostics, so an idle avatar costs nothing.

function applyAvatarAppearance(settings: Pick<GlobalSettings, 'theme' | 'appFontFamily'> | null): void {
  applyDocumentTheme(settings?.theme ?? 'system', { disableTransitions: true })
  document.documentElement.style.setProperty(
    '--app-font-family',
    buildAppFontFamily(settings?.appFontFamily)
  )
}

let startupSettings: GlobalSettings | null = null
try {
  startupSettings = window.api.settings.getSync()
} catch {
  // The theme falls back to the OS until the first settings change arrives.
}
if (startupSettings) {
  // Why: I18nProvider reads the UI language from the app store.
  useAppStore.setState({ settings: startupSettings })
}
applyAvatarAppearance(startupSettings)

function AvatarAppearanceSync(): null {
  useEffect(() => {
    return window.api.settings.onChanged((updates) => {
      const current = useAppStore.getState().settings
      if (!current) {
        return
      }
      const next = { ...current, ...updates }
      useAppStore.setState({ settings: next })
      if ('theme' in updates || 'appFontFamily' in updates) {
        applyAvatarAppearance(next)
      }
    })
  }, [])
  return null
}

function AvatarRoot(): React.JSX.Element {
  useTranslation()
  return <AgentInteractionAvatar />
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Agent interaction avatar root element not found.')
}
getOrCreateRendererRoot(rootElement, import.meta.hot?.data).render(
  <StrictMode>
    <I18nProvider>
      <AvatarAppearanceSync />
      <AvatarRoot />
    </I18nProvider>
  </StrictMode>
)
