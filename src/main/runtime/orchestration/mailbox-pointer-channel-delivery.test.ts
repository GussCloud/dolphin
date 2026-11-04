import { describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from './db'
import { OrchestrationMailboxPointerDelivery } from './mailbox-pointer-delivery'
import { OrchestrationChannelPointerLane } from './channel-mailbox-pointer-lane'
import { WRITE_ACCEPTED } from '../../../shared/pty-write-settlement'

const LEAF = {
  tabId: 'tab-1',
  leafId: 'leaf-1',
  ptyId: 'pty-1',
  writable: true,
  lastAgentStatus: 'idle' as const,
  lastAgentStatusObservedLive: true,
  lastOscTitle: null
}

function setup(options: { connected: boolean; userComposing?: boolean }) {
  const db = new OrchestrationDb(':memory:')
  const push = vi.fn(async () => 'delivered' as const)
  const writePty = vi.fn(() => WRITE_ACCEPTED)
  const deliveryRef: { current: OrchestrationMailboxPointerDelivery<never> | null } = {
    current: null
  }
  const redrive = (handle: string): void =>
    deliveryRef.current?.deliver(LEAF, { mailboxHandle: handle, skipAbsenceProbe: true })
  const channelLane = new OrchestrationChannelPointerLane({
    channel: { connectedSessionId: () => (options.connected ? 'session-1' : null), push },
    getDb: () => db,
    resolvePaneKey: () => 'tab-1:leaf-1',
    redrive
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stubs implement every member delivery calls in these cases.
  const delivery = new OrchestrationMailboxPointerDelivery<never>({
    mailboxOwner: { resolve: () => 'run:run-1' },
    deliveryTarget: { resolveTerminalHandle: () => 'term-1', deferForAbsenceProbe: () => false },
    getDb: () => db,
    getLeaf: () => LEAF,
    getLeafKey: () => 'tab-1:leaf-1',
    getLiveLeafForHandle: () => LEAF,
    // The #164 gate: false while the user composes, which parks the typed pointer.
    isAgentSettledForDelivery: () => !options.userComposing,
    getMessageWaiters: () => undefined,
    getTabTitle: () => null,
    getCliCommand: () => 'dolphin',
    getTerminalHandleForLeafKey: () => 'term-1',
    resolveSubmitTarget: () => ({ leaf: LEAF, terminalHandle: 'term-1', processIncarnation: 'i' }),
    isLeafPtyProvenAbsent: async () => false,
    redriveMailbox: redrive,
    writePty,
    channelLane
  } as never)
  deliveryRef.current = delivery
  const message = db.insertMessage({ from: 'worker', to: 'run:run-1', subject: 'done' })
  return { db, delivery, push, writePty, message }
}

describe('mailbox pointer through the coordinator channel', () => {
  it('pushes the pointer over the channel and types nothing when it is connected', async () => {
    const t = setup({ connected: true })
    t.delivery.deliver(LEAF, { mailboxHandle: 'run:run-1', skipAbsenceProbe: true })
    await new Promise((resolve) => setImmediate(resolve))
    expect(t.push).toHaveBeenCalledWith(
      'tab-1:leaf-1',
      'You have 1 orchestration message. Run `dolphin orchestration check --run run-1`.'
    )
    expect(t.writePty).not.toHaveBeenCalled()
    t.db.close()
  })

  it('still reaches the coordinator while the user composes, since nothing is typed', async () => {
    const t = setup({ connected: true, userComposing: true })
    t.delivery.deliver(LEAF, { mailboxHandle: 'run:run-1', skipAbsenceProbe: true })
    await new Promise((resolve) => setImmediate(resolve))
    expect(t.push).toHaveBeenCalledTimes(1)
    expect(t.writePty).not.toHaveBeenCalled()
    t.db.close()
  })

  it('types the pointer when no channel is connected', async () => {
    const t = setup({ connected: false })
    t.delivery.deliver(LEAF, { mailboxHandle: 'run:run-1', skipAbsenceProbe: true })
    await new Promise((resolve) => setImmediate(resolve))
    expect(t.push).not.toHaveBeenCalled()
    expect(t.writePty).toHaveBeenCalledWith('pty-1', expect.stringContaining('orchestration check'))
    t.db.close()
  })

  it('keeps the composing gate on the typed fallback', async () => {
    const t = setup({ connected: false, userComposing: true })
    t.delivery.deliver(LEAF, { mailboxHandle: 'run:run-1', skipAbsenceProbe: true })
    await new Promise((resolve) => setImmediate(resolve))
    expect(t.writePty).not.toHaveBeenCalled()
    t.db.close()
  })
})
