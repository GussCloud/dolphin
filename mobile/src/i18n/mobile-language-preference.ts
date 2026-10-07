import AsyncStorage from '@react-native-async-storage/async-storage'
import { UI_LANGUAGE_SYSTEM } from '../../../src/shared/ui-language'
import { persistMirrored } from '../storage/mirrored-storage-keys'
import {
  applyMobileLanguagePreference,
  isMobileLanguagePreference,
  type MobileLanguagePreference
} from './mobile-locale-state'

export const MOBILE_LANGUAGE_STORAGE_KEY = 'dolphin:uiLanguage'

export async function loadMobileLanguagePreference(): Promise<MobileLanguagePreference> {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_LANGUAGE_STORAGE_KEY)
    return isMobileLanguagePreference(raw) ? raw : UI_LANGUAGE_SYSTEM
  } catch {
    return UI_LANGUAGE_SYSTEM
  }
}

// Why mirrored: the hybrid shell hands this key to the page in its synchronous `init`.
export async function saveMobileLanguagePreference(
  preference: MobileLanguagePreference
): Promise<void> {
  await persistMirrored(MOBILE_LANGUAGE_STORAGE_KEY, preference)
}

// Counts user choices so a slow startup read cannot overwrite one made while it was in flight.
let choiceCount = 0

/** Switches the UI immediately, then persists; a failed write still rejects for the caller. */
export function setMobileLanguagePreference(preference: MobileLanguagePreference): Promise<void> {
  choiceCount += 1
  applyMobileLanguagePreference(preference)
  return saveMobileLanguagePreference(preference)
}

/** Applies the stored preference at startup. */
export async function hydrateMobileLanguagePreference(): Promise<void> {
  const startedAt = choiceCount
  const stored = await loadMobileLanguagePreference()
  if (choiceCount === startedAt) {
    applyMobileLanguagePreference(stored)
  }
}
