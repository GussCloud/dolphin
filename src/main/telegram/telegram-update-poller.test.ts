import { describe, expect, it, vi } from 'vitest'
import type { TelegramConnectionStatus } from '../../shared/telegram-bridge-state'
import { TelegramApiError, type TelegramUpdate } from './telegram-bot-api'
import { TelegramUpdatePoller } from './telegram-update-poller'

function makePoller(getUpdates: (offset: number) => Promise<TelegramUpdate[]>) {
  const statuses: TelegramConnectionStatus[] = []
  const sleeps: number[] = []
  const onUpdate = vi.fn(async () => {})
  const poller = new TelegramUpdatePoller({
    api: { getMe: async () => ({ username: 'bot' }), getUpdates: vi.fn(getUpdates) },
    onUpdate,
    onStatus: (status) => statuses.push(status),
    sleep: async (ms) => {
      sleeps.push(ms)
    }
  })
  return { poller, statuses, sleeps, onUpdate }
}

describe('TelegramUpdatePoller', () => {
  it('advances the offset past delivered updates and reports ok', async () => {
    const offsets: number[] = []
    const { poller, onUpdate, statuses } = makePoller(async (offset) => {
      offsets.push(offset)
      if (offsets.length === 3) {
        poller.stop()
      }
      return offsets.length === 1 ? [{ updateId: 7 }, { updateId: 9 }] : []
    })
    await poller.run()
    expect(onUpdate).toHaveBeenCalledTimes(2)
    expect(offsets).toEqual([0, 10, 10])
    expect(statuses.at(-1)).toEqual({ state: 'ok', botUsername: 'bot' })
  })

  it('surfaces 409 conflicts and backs off instead of spinning', async () => {
    let calls = 0
    const { poller, statuses, sleeps } = makePoller(async () => {
      calls += 1
      if (calls === 2) {
        poller.stop()
      }
      throw new TelegramApiError('conflict', 'Conflict: terminated by other getUpdates request')
    })
    await poller.run()
    expect(statuses.some((status) => status.state === 'conflict')).toBe(true)
    expect(sleeps[0]).toBe(30_000)
  })

  it('stops polling on an invalid token', async () => {
    const { poller, statuses } = makePoller(async () => {
      throw new TelegramApiError('invalid-token', 'Unauthorized')
    })
    await poller.run()
    expect(statuses.at(-1)?.state).toBe('invalid-token')
  })

  it('waits retry_after on 429 and grows the network backoff', async () => {
    let calls = 0
    const { poller, sleeps } = makePoller(async () => {
      calls += 1
      if (calls === 1) {
        throw new TelegramApiError('rate-limited', 'slow', 7)
      }
      if (calls === 4) {
        poller.stop()
      }
      throw new TelegramApiError('network', 'down')
    })
    await poller.run()
    expect(sleeps).toEqual([7_000, 2_000, 4_000])
  })
})
