import { describe, expect, it, vi } from 'vitest'
import { runDesignMutation } from './design-mutation'

describe('runDesignMutation', () => {
  it('reports and rethrows a failed mutation without reloading', async () => {
    const onError = vi.fn()
    const reload = vi.fn(async () => 'design')
    const failure = new Error('design_invalid_answer')
    await expect(
      runDesignMutation({ mutate: () => Promise.reject(failure), reload, onError })
    ).rejects.toBe(failure)
    expect(onError).toHaveBeenCalledWith(failure)
    expect(reload).not.toHaveBeenCalled()
  })

  it('stays silent when only the reload fails after a successful mutation', async () => {
    const onError = vi.fn()
    const result = await runDesignMutation({
      mutate: async () => ({ decision: {} }),
      reload: () => Promise.reject(new Error('show failed')),
      onError
    })
    expect(result).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })

  it('returns the reloaded design after a successful mutation', async () => {
    const result = await runDesignMutation({
      mutate: async () => undefined,
      reload: async () => 'design',
      onError: vi.fn()
    })
    expect(result).toBe('design')
  })
})
