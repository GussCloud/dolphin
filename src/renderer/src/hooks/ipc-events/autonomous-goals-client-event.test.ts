import { describe, expect, it, vi } from 'vitest'
import { refreshGoalsForClientEvent } from './autonomous-goals-client-event'

describe('refreshGoalsForClientEvent', () => {
  it('refreshes for the active paired environment only', () => {
    const refresh = vi.fn(async () => {})
    refreshGoalsForClientEvent('env-a', 'env-a', refresh)
    refreshGoalsForClientEvent('env-b', 'env-a', refresh)
    refreshGoalsForClientEvent('env-a', undefined, refresh)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
