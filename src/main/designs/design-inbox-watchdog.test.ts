import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DESIGN_INBOX_MAX_NUDGES } from '../../shared/design-types'
import {
  DESIGN_INBOX_ACK_WAIT_MS,
  startDesignInboxWatchdog,
  type DesignInboxWatchdogPorts
} from './design-inbox-watchdog'
import { DesignStore } from './design-store'

type AgentStatus = Awaited<ReturnType<DesignInboxWatchdogPorts['readAgentStatus']>>

describe('design inbox watchdog', () => {
  let dir: string
  let clock: number
  let store: DesignStore
  let status: AgentStatus
  let composing: number | null
  let inputAt: number | undefined
  let liveTerminal: string | null
  let sendResult: boolean
  let sent: string[]
  let stop: () => void

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'design-watchdog-'))
    clock = 1_000_000
    store = new DesignStore(
      () => join(dir, 'designs.json'),
      () => clock
    )
    status = 'idle'
    composing = null
    inputAt = undefined
    liveTerminal = 'term_a'
    sendResult = true
    sent = []
  })

  afterEach(() => {
    stop?.()
    rmSync(dir, { recursive: true, force: true })
  })

  function start(): () => Promise<void> {
    const watchdog = startDesignInboxWatchdog({
      listDesigns: () => store.list(),
      subscribe: (listener) => store.subscribe(listener),
      resolveTerminalHandle: (paneKey) => (paneKey === 'pane-a' ? liveTerminal : null),
      readAgentStatus: async () => status,
      readLastInputAt: () => inputAt,
      readUserComposingWaitMs: () => composing,
      sendNudge: async (terminal, text) => {
        sent.push(`${terminal}: ${text}`)
        return sendResult
      },
      recordNudge: (designId) => {
        store.recordNudge(designId)
      },
      markDeliveryBlocked: (designId) => store.markDeliveryBlocked(designId),
      now: () => clock,
      every: () => () => {}
    })
    stop = watchdog.stop
    return watchdog.check
  }

  function boundDesign(): string {
    const { id } = store.create({ name: 'D', request: 'R', agent: 'claude', repoId: null })
    store.bindAgent(id, { paneKey: 'pane-a', worktreeId: null })
    return id
  }

  /** Lets the subscription-triggered pass finish, without a tick or an explicit check. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve))
  }

  it('nudges at once when the user comments and the agent is idle', async () => {
    start()
    const id = boundDesign()
    expect(sent).toEqual([])
    store.addComment(id, { text: 'Rename the screen' })
    await settle()
    expect(sent).toEqual([
      `term_a: Dolphin Design: new input from the user. Run dolphin design inbox --id ${id} --json, act on it, then ack.`
    ])
    expect(store.get(id)!.delivery).toMatchObject({ nudges: 1, lastNudgeAt: clock })
    expect(store.get(id)!.events.at(-1)).toMatchObject({ kind: 'inbox-nudged', actor: 'dolphin' })
  })

  it('waits while the agent is busy, the status is unreadable, or the user is drafting', async () => {
    const check = start()
    const id = boundDesign()
    for (const blocker of ['working', 'permission', null] as const) {
      status = blocker
      store.addComment(id, { text: `while ${blocker}` })
      await check()
    }
    status = 'idle'
    composing = 500
    await check()
    liveTerminal = null
    composing = null
    await check()
    expect(sent).toEqual([])
    expect(store.get(id)!.delivery.nudges).toBe(0)
    liveTerminal = 'term_a'
    await check()
    expect(sent).toHaveLength(1)
  })

  it('skips a pass after the user typed into the agent pane', async () => {
    const check = start()
    const id = boundDesign()
    status = 'working'
    store.addComment(id, { text: 'x' })
    await check()
    status = 'idle'
    inputAt = 42
    await check()
    expect(sent).toEqual([])
    await check()
    expect(sent).toHaveLength(1)
  })

  it('does not count a nudge that could not be written', async () => {
    const check = start()
    const id = boundDesign()
    sendResult = false
    store.addComment(id, { text: 'x' })
    await check()
    expect(sent.length).toBeGreaterThan(0)
    expect(store.get(id)!.delivery).toEqual({ nudges: 0 })
  })

  it('waits for an ack between nudges and blocks after the limit', async () => {
    const check = start()
    const id = boundDesign()
    store.addComment(id, { text: 'x' })
    await check()
    await check()
    expect(sent).toHaveLength(1)
    for (let nudge = 1; nudge < DESIGN_INBOX_MAX_NUDGES; nudge += 1) {
      clock += DESIGN_INBOX_ACK_WAIT_MS
      await check()
    }
    expect(sent).toHaveLength(DESIGN_INBOX_MAX_NUDGES)
    clock += DESIGN_INBOX_ACK_WAIT_MS - 1
    await check()
    expect(store.get(id)!.delivery.blockedAt).toBeUndefined()
    clock += 1
    await check()
    expect(store.get(id)!.delivery.blockedAt).toBe(clock)
    clock += DESIGN_INBOX_ACK_WAIT_MS * 5
    await check()
    expect(sent).toHaveLength(DESIGN_INBOX_MAX_NUDGES)
    expect(store.get(id)!.events.filter((e) => e.kind === 'delivery-blocked')).toHaveLength(1)
  })

  it('a manual resend nudges again at once', async () => {
    const check = start()
    const id = boundDesign()
    store.addComment(id, { text: 'x' })
    store.recordNudge(id)
    store.markDeliveryBlocked(id)
    await check()
    expect(sent).toEqual([])
    store.resend(id)
    await settle()
    expect(sent).toHaveLength(1)
  })

  it('an ack resets the count so new input is announced without waiting', async () => {
    const check = start()
    const id = boundDesign()
    store.addComment(id, { text: 'first' })
    await check()
    store.ack(
      id,
      store.get(id)!.inbox.map((item) => item.id)
    )
    store.addComment(id, { text: 'second' })
    await settle()
    expect(sent).toHaveLength(2)
    expect(store.get(id)!.delivery.nudges).toBe(1)
  })

  it('ignores designs with nothing pending, no agent, or discarded', async () => {
    const check = start()
    status = 'working'
    const unbound = store.create({ name: 'U', request: 'R', agent: 'claude', repoId: null })
    store.addComment(unbound.id, { text: 'x' })
    const discarded = boundDesign()
    store.addComment(discarded, { text: 'x' })
    store.setStatus(discarded, 'discarded', 'user')
    boundDesign()
    status = 'idle'
    await check()
    expect(sent).toEqual([])
  })
})
