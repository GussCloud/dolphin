import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A real in-memory store: the mirrored write reads the key back after writing it.
const store = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key)
    })
  }
}))

const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
const {
  MOBILE_LANGUAGE_STORAGE_KEY,
  hydrateMobileLanguagePreference,
  loadMobileLanguagePreference,
  setMobileLanguagePreference
} = await import('./mobile-language-preference')
const { applyMobileLanguagePreference, getActiveMobileLocale, getMobileLocaleSnapshot } =
  await import('./mobile-locale-state')
const { readMirroredStorage } = await import('../storage/mirrored-storage-keys')
const { isPageStorageKey } = await import('../mobile-web-shell/page-storage-keys')

beforeEach(() => {
  store.clear()
})

afterEach(() => {
  applyMobileLanguagePreference('system')
})

describe('language preference persistence', () => {
  it('defaults to system when nothing or something unknown is stored', async () => {
    await expect(loadMobileLanguagePreference()).resolves.toBe('system')
    store.set(MOBILE_LANGUAGE_STORAGE_KEY, 'klingon')
    await expect(loadMobileLanguagePreference()).resolves.toBe('system')
  })

  it('falls back to system when the store cannot be read', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'))
    await expect(loadMobileLanguagePreference()).resolves.toBe('system')
  })

  it('switches the UI at once and persists through the mirrored path', async () => {
    const saved = setMobileLanguagePreference('ko')
    expect(getActiveMobileLocale()).toBe('ko')
    await saved
    expect(store.get(MOBILE_LANGUAGE_STORAGE_KEY)).toBe('ko')
    expect(readMirroredStorage([MOBILE_LANGUAGE_STORAGE_KEY])).toEqual({
      [MOBILE_LANGUAGE_STORAGE_KEY]: 'ko'
    })
    await expect(loadMobileLanguagePreference()).resolves.toBe('ko')
  })

  it('hydrates the stored choice at startup', async () => {
    store.set(MOBILE_LANGUAGE_STORAGE_KEY, 'fr')
    await hydrateMobileLanguagePreference()
    expect(getMobileLocaleSnapshot()).toEqual({ preference: 'fr', locale: 'fr' })
  })

  it('does not let a slow startup read overwrite a choice made meanwhile', async () => {
    store.set(MOBILE_LANGUAGE_STORAGE_KEY, 'fr')
    const hydration = hydrateMobileLanguagePreference()
    await setMobileLanguagePreference('ja')
    await hydration
    expect(getActiveMobileLocale()).toBe('ja')
  })

  it('is handed to the hybrid page, which renders translated screens too', () => {
    expect(isPageStorageKey(MOBILE_LANGUAGE_STORAGE_KEY)).toBe(true)
  })
})
