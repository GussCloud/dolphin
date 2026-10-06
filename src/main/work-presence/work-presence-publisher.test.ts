import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  WORK_PRESENCE_DEBOUNCE_MS,
  WORK_PRESENCE_DEFAULT_HEARTBEAT_MS,
  WORK_PRESENCE_IDLE_RECHECK_MS,
  WorkPresencePublisher,
  type WorkPresenceSendOutcome
} from './work-presence-publisher'
import type { WorkPresenceSnapshot } from './work-presence-snapshot'

function snapshot(projectName = 'dolphin'): WorkPresenceSnapshot {
  return {
    schemaVersion: 1,
    machineId: 'machine-1',
    machineLabel: 'host',
    projects: [{ id: 'p1', name: projectName, agents: [] }]
  }
}

function setup(outcomes: WorkPresenceSendOutcome[] = []) {
  let current = snapshot()
  const send = vi.fn(
    async (_snapshot: WorkPresenceSnapshot): Promise<WorkPresenceSendOutcome> =>
      outcomes.shift() ?? { status: 'ok', heartbeatMs: null }
  )
  const sendGoodbye = vi.fn(async (_machineId: string) => {})
  const publisher = new WorkPresencePublisher({
    buildSnapshot: async () => current,
    send,
    sendGoodbye
  })
  return {
    publisher,
    send,
    sendGoodbye,
    setSnapshot: (next: WorkPresenceSnapshot) => {
      current = next
    }
  }
}

describe('WorkPresencePublisher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('publishes on start and then on the heartbeat', async () => {
    const { publisher, send } = setup()
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(WORK_PRESENCE_DEFAULT_HEARTBEAT_MS - 1)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('follows the server heartbeat within safe bounds', async () => {
    const { publisher, send } = setup([{ status: 'ok', heartbeatMs: 10_000 }])
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('debounces changes and skips an unchanged snapshot', async () => {
    const { publisher, send, setSnapshot } = setup()
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    publisher.notifyChange()
    publisher.notifyChange()
    await vi.advanceTimersByTimeAsync(WORK_PRESENCE_DEBOUNCE_MS)
    expect(send).toHaveBeenCalledTimes(1)

    setSnapshot(snapshot('renamed'))
    publisher.notifyChange()
    publisher.notifyChange()
    await vi.advanceTimersByTimeAsync(WORK_PRESENCE_DEBOUNCE_MS - 1)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].projects[0].name).toBe('renamed')
  })

  it('backs off for ten minutes when the account has no organization', async () => {
    const { publisher, send, setSnapshot } = setup([{ status: 'no-organization' }])
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    setSnapshot(snapshot('changed'))
    publisher.notifyChange()
    await vi.advanceTimersByTimeAsync(WORK_PRESENCE_IDLE_RECHECK_MS - 1)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('backs off exponentially on network failures and never throws', async () => {
    const { publisher, send } = setup([{ status: 'failed' }, { status: 'failed' }])
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('treats a thrown send as a failure', async () => {
    const { publisher, send } = setup()
    send.mockRejectedValueOnce(new Error('offline'))
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('resumes immediately after a sign-in', async () => {
    const { publisher, send } = setup([{ status: 'signed-out' }])
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    publisher.resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('sends DELETE on stop after a successful publish and then goes quiet', async () => {
    const { publisher, send, sendGoodbye } = setup()
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await publisher.stop()
    expect(sendGoodbye).toHaveBeenCalledWith('machine-1')
    await vi.advanceTimersByTimeAsync(WORK_PRESENCE_IDLE_RECHECK_MS)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('skips DELETE on stop when nothing was published', async () => {
    const { publisher, sendGoodbye } = setup([{ status: 'no-organization' }])
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await publisher.stop()
    expect(sendGoodbye).not.toHaveBeenCalled()
  })

  it('says goodbye with the sign-out session and stops publishing changes', async () => {
    const { publisher, send, sendGoodbye } = setup()
    publisher.start()
    await vi.advanceTimersByTimeAsync(0)
    const goodbye = vi.fn(async (_machineId: string) => {})
    await publisher.signOut(goodbye)
    expect(goodbye).toHaveBeenCalledWith('machine-1')
    expect(sendGoodbye).not.toHaveBeenCalled()
    publisher.notifyChange()
    await vi.advanceTimersByTimeAsync(WORK_PRESENCE_DEFAULT_HEARTBEAT_MS)
    expect(send).toHaveBeenCalledTimes(1)
    await publisher.stop()
    expect(sendGoodbye).not.toHaveBeenCalled()
  })
})
