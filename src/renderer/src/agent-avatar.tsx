import './assets/main.css'

import { StrictMode, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentInteractionAvatar } from './components/agent-interaction-avatar/AgentInteractionAvatar'
import { I18nProvider } from './i18n/I18nProvider'
import { applyDocumentTheme } from './lib/document-theme'
import { buildAppFontFamily } from './lib/app-font-family'
import { getOrCreateRendererRoot } from './lib/react-renderer-root'
import type { GlobalSettings } from '../../shared/global-settings-types'

// Why its own entry: the avatar is a separate always-on-top window; it shares the preload but
// keeps no app store and no periodic diagnostics, so an idle avatar costs nothing.

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
applyAvatarAppearance(startupSettings)

function AvatarAppearanceSync(): null {
  useEffect(() => {
    let current = startupSettings
    return window.api.settings.onChanged((updates) => {
      if (current && ('theme' in updates || 'appFontFamily' in updates)) {
        current = { ...current, ...updates }
        applyAvatarAppearance(current)
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
