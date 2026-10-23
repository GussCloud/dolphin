// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DEEPSEEK_MODEL_SLOTS,
  type DeepSeekCredentialsStatus,
  type DeepSeekListModelsResult
} from '../../../../shared/deepseek-claude-provider'
import { DeepSeekProviderSettings } from './DeepSeekProviderSettings'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const api = {
  getStatus: vi.fn<() => Promise<DeepSeekCredentialsStatus>>(),
  saveApiKey: vi.fn<(key: string) => Promise<DeepSeekCredentialsStatus>>(),
  clearApiKey: vi.fn<() => Promise<DeepSeekCredentialsStatus>>(),
  listModels: vi.fn<() => Promise<DeepSeekListModelsResult>>()
}

beforeEach(() => {
  vi.resetAllMocks()
  Reflect.set(window, 'api', { deepseekCredentials: api })
})

afterEach(() => cleanup())

describe('DeepSeekProviderSettings', () => {
  it('shows only the key field until a key is configured, then loads the model pickers', async () => {
    api.getStatus.mockResolvedValue({ apiKeyConfigured: false, encryptionAvailable: true })
    api.saveApiKey.mockResolvedValue({ apiKeyConfigured: true, encryptionAvailable: true })
    api.listModels.mockResolvedValue({
      ok: true,
      models: [{ id: 'deepseek-flash', contextWindow: 1_000_000 }]
    })

    render(<DeepSeekProviderSettings slots={DEFAULT_DEEPSEEK_MODEL_SLOTS} onSaveSlots={vi.fn()} />)

    await screen.findByText('Not configured')
    expect(screen.getByText(/own config folder \(~\/\.claude-deepseek\)/)).not.toBeNull()
    expect(api.listModels).not.toHaveBeenCalled()
    expect(screen.queryByRole('combobox')).toBeNull()

    const input = screen.getByPlaceholderText('Paste your DeepSeek API key')
    fireEvent.change(input, { target: { value: '  sk-test  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(5))
    expect(api.saveApiKey).toHaveBeenCalledWith('sk-test')
    expect(screen.getByText('Configured')).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'Main model' }).textContent).toContain(
      'deepseek-flash[1m]'
    )
  })

  it('shows the failure reason with a retry that reloads the list', async () => {
    api.getStatus.mockResolvedValue({ apiKeyConfigured: true, encryptionAvailable: true })
    api.listModels
      .mockResolvedValueOnce({ ok: false, reason: 'unauthorized' })
      .mockResolvedValueOnce({ ok: true, models: [{ id: 'deepseek-flash', contextWindow: null }] })

    render(<DeepSeekProviderSettings slots={DEFAULT_DEEPSEEK_MODEL_SLOTS} onSaveSlots={vi.fn()} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('rejected the saved API key')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(5))
    expect(api.listModels).toHaveBeenCalledTimes(2)
  })

  it('shows the main-process save error inline until the key is edited', async () => {
    api.getStatus.mockResolvedValue({ apiKeyConfigured: false, encryptionAvailable: true })
    api.saveApiKey.mockRejectedValue(
      new Error(
        "Error invoking remote method 'deepseekCredentials:saveApiKey': Error: Secure storage is unavailable on this system, so Dolphin can't save the DeepSeek key."
      )
    )

    render(<DeepSeekProviderSettings slots={DEFAULT_DEEPSEEK_MODEL_SLOTS} onSaveSlots={vi.fn()} />)

    const input = await screen.findByPlaceholderText('Paste your DeepSeek API key')
    fireEvent.change(input, { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      "Secure storage is unavailable on this system, so Dolphin can't save the DeepSeek key."
    )
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Not configured')).not.toBeNull()

    fireEvent.change(input, { target: { value: 'sk-test2' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('disables saving and says why when the system has no secure storage', async () => {
    api.getStatus.mockResolvedValue({ apiKeyConfigured: false, encryptionAvailable: false })

    render(<DeepSeekProviderSettings slots={DEFAULT_DEEPSEEK_MODEL_SLOTS} onSaveSlots={vi.fn()} />)

    await screen.findByText(/Secure storage is unavailable on this system/)
    const input = screen.getByPlaceholderText('Paste your DeepSeek API key')
    expect(input.hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true)
  })

  it('hides the pickers again after the key is cleared', async () => {
    api.getStatus.mockResolvedValue({ apiKeyConfigured: true, encryptionAvailable: true })
    api.clearApiKey.mockResolvedValue({ apiKeyConfigured: false, encryptionAvailable: true })
    api.listModels.mockResolvedValue({ ok: true, models: [] })

    render(<DeepSeekProviderSettings slots={DEFAULT_DEEPSEEK_MODEL_SLOTS} onSaveSlots={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(5))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await screen.findByText('Not configured')
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
