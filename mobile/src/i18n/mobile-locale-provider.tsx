import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { SupportedUiLocale } from '../../../src/shared/ui-locale'
import {
  hydrateMobileLanguagePreference,
  setMobileLanguagePreference
} from './mobile-language-preference'
import { refreshMobileSystemLocale, type MobileLanguagePreference } from './mobile-locale-state'
import { useMobileLocaleSnapshot } from './use-mobile-translation'

export type MobileLocaleContextValue = {
  readonly locale: SupportedUiLocale
  readonly preference: MobileLanguagePreference
  readonly setPreference: (preference: MobileLanguagePreference) => Promise<void>
}

const MobileLocaleContext = createContext<MobileLocaleContextValue | null>(null)

/** Mounted once at the root: loads the stored language and follows device-language changes. */
export function MobileLocaleProvider({ children }: { children: ReactNode }) {
  const { locale, preference } = useMobileLocaleSnapshot()

  useEffect(() => {
    void hydrateMobileLanguagePreference()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshMobileSystemLocale()
      }
    })
    return () => subscription.remove()
  }, [])

  const value = useMemo(
    () => ({ locale, preference, setPreference: setMobileLanguagePreference }),
    [locale, preference]
  )
  return <MobileLocaleContext.Provider value={value}>{children}</MobileLocaleContext.Provider>
}

/** The Language setting's view; outside the provider it still reads and writes the shared store. */
export function useMobileLanguageSetting(): MobileLocaleContextValue {
  const context = useContext(MobileLocaleContext)
  const { locale, preference } = useMobileLocaleSnapshot()
  return context ?? { locale, preference, setPreference: setMobileLanguagePreference }
}
