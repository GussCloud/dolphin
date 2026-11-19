import { useEffect } from 'react'
import { useAppStore } from '../store'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { applyDocumentTheme } from './document-theme'
import { buildAppFontFamily } from './app-font-family'

function applyPopoutAppearance(settings: GlobalSettings | null): void {
  applyDocumentTheme(settings?.theme ?? 'system', { disableTransitions: false })
  document.documentElement.style.setProperty(
    '--app-font-family',
    buildAppFontFamily(settings?.appFontFamily)
  )
}

/**
 * Pop-out windows own a separate renderer store; seed settings and appearance
 * synchronously so a forced light/dark theme does not flash before first paint.
 */
export function seedPopoutWindowSettings(): void {
  let startupSettings: GlobalSettings | null = null
  try {
    startupSettings = window.api.settings.getSync()
  } catch {
    // Async hydration in usePopoutWindowSettingsSync remains available if the startup read fails.
  }
  if (startupSettings) {
    useAppStore.setState({ settings: startupSettings })
  }
  applyPopoutAppearance(startupSettings)
}

/** Keeps a pop-out's settings, keybindings, theme and font in step with the main window. */
export function usePopoutWindowSettingsSync(): void {
  const settings = useAppStore((state) => state.settings)

  useEffect(() => {
    let disposed = false
    // Why: copy/paste chords honor user keybinding overrides, which live in a separate file from settings.
    void useAppStore.getState().fetchKeybindings()
    const setSettings = (next: GlobalSettings): void => {
      if (!disposed) {
        useAppStore.setState({ settings: next })
      }
    }
    const offChanged = window.api.settings.onChanged((updates) => {
      const current = useAppStore.getState().settings
      if (current) {
        setSettings({ ...current, ...updates })
      }
    })
    void window.api.settings
      .get()
      .then(setSettings)
      .catch(() => undefined)
    return () => {
      disposed = true
      offChanged()
    }
  }, [])

  useEffect(() => {
    applyPopoutAppearance(settings)
    if (settings?.theme !== 'system') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (): void => applyDocumentTheme('system')
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [settings])
}
