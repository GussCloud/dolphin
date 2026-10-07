import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UI_LANGUAGE_ENGLISH, UI_LANGUAGE_PORTUGUESE_BRAZIL } from '../../shared/ui-language'
import { setMainUiLanguage } from '../i18n/main-i18n'

const { showMessageBoxMock } = vi.hoisted(() => ({
  showMessageBoxMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getLocale: () => 'en-US' },
  dialog: { showMessageBox: showMessageBoxMock }
}))

import { promptForGpuFallbackRestart } from './gpu-fallback-restart-prompt'

beforeEach(async () => {
  showMessageBoxMock.mockReset()
  await setMainUiLanguage(UI_LANGUAGE_ENGLISH)
})

describe('promptForGpuFallbackRestart', () => {
  it('offers a restart without forcing it', async () => {
    const parentWindow = { id: 1 }
    showMessageBoxMock.mockResolvedValue({ response: 0 })

    await expect(promptForGpuFallbackRestart(parentWindow as never)).resolves.toBe('restart')
    expect(showMessageBoxMock).toHaveBeenCalledWith(parentWindow, {
      type: 'warning',
      buttons: ['Restart in Safe Graphics Mode', 'Keep Running'],
      defaultId: 0,
      cancelId: 1,
      title: 'Restart Dolphin in Safe Graphics Mode?',
      message: "Dolphin's graphics process has crashed repeatedly.",
      detail:
        'Safe graphics mode disables hardware acceleration and WebGL for this Dolphin version. Terminals and 3D content may render more slowly. Keep Running leaves graphics settings unchanged.'
    })
  })

  it('treats the secondary or dismissed response as continue', async () => {
    showMessageBoxMock.mockResolvedValue({ response: 1 })

    await expect(promptForGpuFallbackRestart()).resolves.toBe('continue')
    expect(showMessageBoxMock).toHaveBeenCalledOnce()
  })
})

describe('promptForGpuFallbackRestart localization', () => {
  it('reads the dialog copy in the selected UI language at prompt time', async () => {
    await setMainUiLanguage(UI_LANGUAGE_PORTUGUESE_BRAZIL)
    showMessageBoxMock.mockResolvedValue({ response: 0 })

    await promptForGpuFallbackRestart()
    expect(showMessageBoxMock.mock.calls[0][0].buttons[0]).toBe('Reiniciar no Modo Gráfico Seguro')
  })
})
