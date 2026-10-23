import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const storeMock = vi.hoisted(() => ({
  hasDeepSeekApiKey: vi.fn(() => false),
  isDeepSeekKeyEncryptionAvailable: vi.fn(() => true),
  saveDeepSeekApiKey: vi.fn(),
  clearDeepSeekApiKey: vi.fn(),
  readDeepSeekApiKey: vi.fn((): string | null => null)
}))
const requestMock = vi.hoisted(() => ({ requestDeepSeekModels: vi.fn() }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler)
  },
  net: { fetch: vi.fn() }
}))
vi.mock('../deepseek/deepseek-api-key-store', () => storeMock)
vi.mock('../deepseek/deepseek-models-request', () => requestMock)

import { registerDeepSeekCredentialsHandlers } from './deepseek-credentials'

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`no handler for ${channel}`)
  }
  return handler({}, ...args)
}

describe('deepseek credentials IPC', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetAllMocks()
    storeMock.hasDeepSeekApiKey.mockReturnValue(false)
    storeMock.isDeepSeekKeyEncryptionAvailable.mockReturnValue(true)
    storeMock.readDeepSeekApiKey.mockReturnValue(null)
    registerDeepSeekCredentialsHandlers()
  })

  it('returns only whether a key is configured, never the key', () => {
    storeMock.hasDeepSeekApiKey.mockReturnValue(true)
    storeMock.readDeepSeekApiKey.mockReturnValue('sk-secret')
    expect(invoke('deepseekCredentials:getStatus')).toEqual({ apiKeyConfigured: true, encryptionAvailable: true })
    expect(invoke('deepseekCredentials:saveApiKey', 'sk-new')).toEqual({ apiKeyConfigured: true, encryptionAvailable: true })
    expect(storeMock.saveDeepSeekApiKey).toHaveBeenCalledWith('sk-new')
  })

  it('reports when secure storage is unavailable', () => {
    storeMock.isDeepSeekKeyEncryptionAvailable.mockReturnValue(false)
    expect(invoke('deepseekCredentials:getStatus')).toEqual({
      apiKeyConfigured: false,
      encryptionAvailable: false
    })
  })

  it('rejects a non-string key from the renderer', () => {
    expect(() => invoke('deepseekCredentials:saveApiKey', 42)).toThrow(/must be a string/)
    expect(storeMock.saveDeepSeekApiKey).not.toHaveBeenCalled()
  })

  it('answers no-api-key without calling DeepSeek when nothing is saved or readable', async () => {
    await expect(invoke('deepseekCredentials:listModels')).resolves.toEqual({
      ok: false,
      reason: 'no-api-key'
    })
    storeMock.readDeepSeekApiKey.mockImplementation(() => {
      throw new Error('decrypt')
    })
    await expect(invoke('deepseekCredentials:listModels')).resolves.toEqual({
      ok: false,
      reason: 'no-api-key'
    })
    expect(requestMock.requestDeepSeekModels).not.toHaveBeenCalled()
  })

  it('lists models with the stored key', async () => {
    storeMock.readDeepSeekApiKey.mockReturnValue('sk-stored')
    requestMock.requestDeepSeekModels.mockResolvedValue({ ok: true, models: [] })
    await expect(invoke('deepseekCredentials:listModels')).resolves.toEqual({
      ok: true,
      models: []
    })
    expect(requestMock.requestDeepSeekModels).toHaveBeenCalledWith(
      'sk-stored',
      expect.any(Function)
    )
  })
})
