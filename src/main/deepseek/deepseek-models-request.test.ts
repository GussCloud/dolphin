import { describe, expect, it, vi } from 'vitest'
import { DEEPSEEK_MODELS_URL } from '../../shared/deepseek-claude-provider'
import { parseDeepSeekModelsResponse, requestDeepSeekModels } from './deepseek-models-request'

function respond(status: number, body: unknown) {
  return vi.fn(async (_url: string, _init: { signal: AbortSignal }) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }))
}

describe('requestDeepSeekModels', () => {
  it('sends the key as a bearer token and maps the model list', async () => {
    const fetchImpl = respond(200, {
      object: 'list',
      data: [
        { id: 'deepseek-flash', object: 'model', owned_by: 'deepseek' },
        { id: 'deepseek-pro', context_window: 1_048_576 },
        { id: 'deepseek-flash' },
        { id: '' },
        'junk'
      ]
    })
    const result = await requestDeepSeekModels('sk-1', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      DEEPSEEK_MODELS_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-1' }),
        signal: expect.any(AbortSignal)
      })
    )
    expect(result).toEqual({
      ok: true,
      models: [
        { id: 'deepseek-flash', contextWindow: null },
        { id: 'deepseek-pro', contextWindow: 1_048_576 }
      ]
    })
  })

  it.each([401, 403])('maps HTTP %i to unauthorized', async (status) => {
    await expect(requestDeepSeekModels('sk-bad', respond(status, {}))).resolves.toEqual({
      ok: false,
      reason: 'unauthorized'
    })
  })

  it('maps a server error and a thrown fetch to network', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(requestDeepSeekModels('sk', respond(503, {}))).resolves.toEqual({
      ok: false,
      reason: 'network'
    })
    const failing = vi.fn(async () => {
      throw new Error('timeout')
    })
    await expect(requestDeepSeekModels('sk', failing)).resolves.toEqual({
      ok: false,
      reason: 'network'
    })
  })

  it('maps a body without a data list to invalid-response', async () => {
    await expect(requestDeepSeekModels('sk', respond(200, { models: [] }))).resolves.toEqual({
      ok: false,
      reason: 'invalid-response'
    })
    expect(parseDeepSeekModelsResponse(null)).toBeNull()
  })
})
