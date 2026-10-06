import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DolphinCloudSession } from './profile-cloud-session-store'
import {
  emitDolphinCloudSigningOut,
  onDolphinCloudSigningOut
} from './profile-cloud-sign-out-events'

const session: DolphinCloudSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: 999,
  capabilities: { flags: {}, refreshedAt: 1 }
}

describe('emitDolphinCloudSigningOut', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hands every listener the session and tolerates a failing one', async () => {
    const seen = vi.fn(async (_session: DolphinCloudSession) => {})
    const off = [
      onDolphinCloudSigningOut(async () => {
        throw new Error('offline')
      }),
      onDolphinCloudSigningOut(seen)
    ]
    await emitDolphinCloudSigningOut(session)
    expect(seen).toHaveBeenCalledWith(session)
    off.forEach((unsubscribe) => unsubscribe())
  })

  it('does not let a stalled listener hold sign-out', async () => {
    vi.useFakeTimers()
    const off = onDolphinCloudSigningOut(() => new Promise(() => {}))
    const done = vi.fn()
    void emitDolphinCloudSigningOut(session).then(done)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(done).toHaveBeenCalled()
    off()
  })
})
