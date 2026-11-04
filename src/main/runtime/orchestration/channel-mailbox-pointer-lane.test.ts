import { describe, expect, it, vi } from 'vitest'
import type { OrchestrationDb } from './db'
import type { OrchestrationMailboxLeaf } from './mailbox-owner'
import {
  OrchestrationChannelPointerLane,
  type OrchestrationPointerChannel
} from './channel-mailbox-pointer-lane'

const leaf: OrchestrationMailboxLeaf = {
  tabId: 'tab',
  leafId: 'leaf',
  ptyId: 'pty-1',
  writable: true,
  lastAgentStatus: 'idle',
  lastAgentStatusObservedLive: true,
  lastOscTitle: null
}
const batch = { messageIds: ['m1'], text: 'You have 1 orchestration message.' }

function setup(
  options: {
    sessionId?: string | null
    outcome?: 'delivered' | 'not-connected' | 'unconfirmed'
  } = {}
) {
  let now = 0
  let unread = true
  let sessionId = options.sessionId === undefined ? 'session-1' : options.sessionId
  const push = vi.fn(async () => options.outcome ?? 'delivered')
  const channel: OrchestrationPointerChannel = { connectedSessionId: () => sessionId, push }
  const markAsDelivered = vi.fn()
  const db = {
    areUnreadMessages: () => unread,
    markAsDelivered
  }
  const redrive = vi.fn()
  const lane = new OrchestrationChannelPointerLane({
    channel,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the lane calls only the two methods stubbed here.
    getDb: () => db as unknown as OrchestrationDb,
    resolvePaneKey: () => 'tab:leaf',
    redrive,
    now: () => now,
    graceMs: 60_000
  })
  return {
    lane,
    push,
    redrive,
    markAsDelivered,
    advance: (ms: number) => (now += ms),
    read: () => (unread = false),
    arrive: () => (unread = true),
    relaunch: (id: string) => (sessionId = id)
  }
}

describe('OrchestrationChannelPointerLane', () => {
  it('declines when no channel is polling in the pane, so the pointer is typed', () => {
    const { lane, push } = setup({ sessionId: null })
    expect(lane.offer(leaf, 'run:1', () => batch)).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('pushes instead of typing, and holds further pointers until the first is read', async () => {
    const t = setup()
    expect(t.lane.offer(leaf, 'run:1', () => batch)).toBe(true)
    expect(t.push).toHaveBeenCalledWith('tab:leaf', batch.text)
    await Promise.resolve()
    expect(t.lane.offer(leaf, 'run:1', () => batch)).toBe(true)
    expect(t.push).toHaveBeenCalledTimes(1)
    // Unproven: rows stay undelivered so the typed path can still take them.
    expect(t.markAsDelivered).not.toHaveBeenCalled()
  })

  it('proves the channel once the announced mail is read, then marks later pushes delivered', async () => {
    const t = setup()
    t.lane.offer(leaf, 'run:1', () => batch)
    await Promise.resolve()
    t.read()
    t.arrive()
    t.read()
    expect(t.lane.offer(leaf, 'run:1', () => ({ messageIds: ['m2'], text: 'next' }))).toBe(true)
    expect(t.push).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(t.markAsDelivered).toHaveBeenCalledWith(['m2']))
  })

  it('falls back to typing for the session when a push stays unread past the grace', async () => {
    const t = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    t.lane.offer(leaf, 'run:1', () => batch)
    await Promise.resolve()
    t.advance(60_000)
    expect(t.lane.offer(leaf, 'run:1', () => batch)).toBe(false)
    expect(t.lane.offer(leaf, 'run:1', () => batch)).toBe(false)
    // A relaunched `claude` gets a fresh trial.
    t.relaunch('session-2')
    expect(t.lane.offer(leaf, 'run:1', () => batch)).toBe(true)
    warn.mockRestore()
  })

  it('redrives to the typed path when the channel was gone at push time', async () => {
    const t = setup({ outcome: 'not-connected' })
    expect(t.lane.offer(leaf, 'run:1', () => batch)).toBe(true)
    await vi.waitFor(() => expect(t.redrive).toHaveBeenCalledWith('run:1'))
  })

  it('owns the delivery but pushes nothing when there is no batch', () => {
    const t = setup()
    expect(t.lane.offer(leaf, 'run:1', () => null)).toBe(true)
    expect(t.push).not.toHaveBeenCalled()
  })
})
