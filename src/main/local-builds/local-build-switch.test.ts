import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
  loadLocalBuildCandidate: vi.fn(),
  assertLocalBuildCompatibility: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', getLocale: () => 'en-US' },
  dialog: {
    showOpenDialog: mocks.showOpenDialog,
    showMessageBox: mocks.showMessageBox
  }
}))
vi.mock('./local-build-candidate', () => ({
  loadLocalBuildCandidate: mocks.loadLocalBuildCandidate
}))
vi.mock('./local-build-compatibility', () => ({
  assertLocalBuildCompatibility: mocks.assertLocalBuildCompatibility
}))

import { UI_LANGUAGE_ENGLISH, UI_LANGUAGE_PORTUGUESE_BRAZIL } from '../../shared/ui-language'
import { setMainUiLanguage } from '../i18n/main-i18n'
import { chooseLocalBuild } from './local-build-switch'

function stubCandidate(version: string, liveTerminalCount: number) {
  const candidate = {
    version,
    compatibility: {},
    close: vi.fn(async () => {})
  }
  mocks.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: ['/builds/latest.yml']
  })
  mocks.loadLocalBuildCandidate.mockResolvedValue(candidate)
  mocks.assertLocalBuildCompatibility.mockResolvedValue({ liveTerminalCount })
  return candidate
}

beforeEach(async () => {
  vi.clearAllMocks()
  await setMainUiLanguage(UI_LANGUAGE_ENGLISH)
})

describe('chooseLocalBuild', () => {
  it('summarizes live terminals with count-specific copy', async () => {
    stubCandidate('1.0.1', 3)
    mocks.showMessageBox.mockResolvedValue({ response: 1 })

    await expect(chooseLocalBuild(null)).resolves.toBeNull()
    const options = mocks.showMessageBox.mock.calls[0][0]
    expect(options.title).toBe('Use Local Dolphin Build?')
    expect(options.detail).toMatch(/^3 live terminals will reconnect after restart\.\n/)
    expect(options.buttons).toEqual(['Use Local Build', 'Cancel'])
  })

  it('uses the selected UI language for the native dialogs', async () => {
    await setMainUiLanguage(UI_LANGUAGE_PORTUGUESE_BRAZIL)
    const candidate = stubCandidate('1.0.1', 1)
    mocks.showMessageBox.mockResolvedValue({ response: 0 })

    await expect(chooseLocalBuild(null)).resolves.toBe(candidate)
    expect(mocks.showOpenDialog.mock.calls[0][0].buttonLabel).toBe('Escolher Build')
    const options = mocks.showMessageBox.mock.calls[0][0]
    expect(options.detail).toMatch(/^1 terminal ativo vai se reconectar após reiniciar\.\n/)
    expect(options.buttons).toEqual(['Usar Build Local', 'Cancelar'])
  })

  it('rejects a build with the running version and closes it', async () => {
    const candidate = stubCandidate('1.0.0', 0)

    await expect(chooseLocalBuild(null)).rejects.toThrow('same version as the running app')
    expect(candidate.close).toHaveBeenCalledOnce()
    expect(mocks.showMessageBox).not.toHaveBeenCalled()
  })
})
