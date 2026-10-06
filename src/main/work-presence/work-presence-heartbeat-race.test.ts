import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WORK_PRESENCE_DEBOUNCE_MS,
  WORK_PRESENCE_DEFAULT_HEARTBEAT_MS,
  WorkPresencePublisher,
  type WorkPresenceSendOutcome
} from './work-presence-publisher'
import type { WorkPresenceSnapshot } from './work-presence-snapshot'

const SNAPSHOT: WorkPresenceSnapshot = {
  schemaVersion: 1,
  machineId: 'machine-1',
  machineLabel: 'host',
  projects: [{ id: 'p1', name: 'dolphin', agents: [] }]
}
const BUILD_MS = 500

describe('WorkPresencePublisher heartbeat race', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the heartbeat alive when it fires while an unchanged change-publish is building', async () => {
    const send = vi.fn(
      async (_s: WorkPresenceSnapshot): Promise<WorkPresenceSendOutcome> => ({
        status: 'ok',
        heartbeatMs: null
      })
    )
    const publisher = new WorkPresencePublisher({
      // Why slow: getWorktreePs is async, so a heartbeat can land mid-build.
      buildSnapshot: () => new Promise((resolve) => setTimeout(() => resolve(SNAPSHOT), BUILD_MS)),
      send,
      sendGoodbye: async () => {}
    })
    publisher.start()
    await vi.advanceTimersByTimeAsync(BUILD_MS)
    expect(send).toHaveBeenCalledTimes(1)

    // Change-publish starts building just before the heartbeat is due.
    await vi.advanceTimersByTimeAsync(
      WORK_PRESENCE_DEFAULT_HEARTBEAT_MS - WORK_PRESENCE_DEBOUNCE_MS - 200
    )
    publisher.notifyChange()
    await vi.advanceTimersByTimeAsync(3 * WORK_PRESENCE_DEFAULT_HEARTBEAT_MS)

    expect(send.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
