import { describe, expect, it, vi } from 'vitest'
import { SESSION_TABS_AUTHORITATIVE_INVENTORY_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import type {
  RuntimeMobileSessionTabsResult,
  RuntimeMobileSessionTabsSnapshot
} from '../../../../shared/runtime-types'
import { DolphinRuntimeService } from '../../dolphin-runtime'
import type { MobileSessionTabsChangeListener } from '../../mobile-session-tabs-change-delivery'
import { RpcDispatcher } from '../dispatcher'
import { SESSION_TAB_METHODS } from './session-tabs'
import { subscribeSessionTabsInventory } from './session-tabs-inventory'

// A headed host publishes a title from main's live tracker, then the renderer graph restates it
// at its own newer version. Only that restatement may be dropped, and only per subscriber.
const WT = 'wt-restatement'

function snapshot(version: number, title = 'Cursor ready'): RuntimeMobileSessionTabsSnapshot {
  return {
    worktree: WT,
    publicationEpoch: 'renderer:epoch',
    snapshotVersion: version,
    activeGroupId: null,
    activeTabId: 'tab-1::leaf-1',
    activeTabType: 'terminal',
    tabs: [
      {
        type: 'terminal',
        id: 'tab-1::leaf-1',
        parentTabId: 'tab-1',
        leafId: 'leaf-1',
        title,
        isActive: true
      }
    ]
  }
}

type RuntimeInternals = {
  refreshMobileSessionPtyInventory: () => Promise<unknown>
  mobileSessionTabsNotifyCoalescer: { flushAll: () => void }
}

async function subscribeInventory(runtime: DolphinRuntimeService, id: string) {
  const internals = runtime as unknown as RuntimeInternals
  vi.spyOn(internals, 'refreshMobileSessionPtyInventory').mockResolvedValue({
    livePtyIds: new Set(),
    allLivePtyIds: new Set(),
    terminalIdentityByPtyId: new Map(),
    queriedHostIds: new Set(['local'])
  })
  const emit = vi.fn<(event: unknown) => void>()
  await subscribeSessionTabsInventory(
    {
      runtime,
      connectionId: `conn-${id}`,
      requestId: `req-${id}`,
      pairedDeviceId: `device-${id}`,
      clientCapabilities: [SESSION_TABS_AUTHORITATIVE_INVENTORY_RUNTIME_CAPABILITY]
    },
    emit
  )
  return emit
}

function createRuntime() {
  const runtime = new DolphinRuntimeService()
  const internals = runtime as unknown as RuntimeInternals
  const publish = (snapshots: RuntimeMobileSessionTabsSnapshot[]): void => {
    runtime.syncWindowGraph(0, { tabs: [], leaves: [], mobileSessionTabs: snapshots })
  }
  const flush = (): void => internals.mobileSessionTabsNotifyCoalescer.flushAll()
  return { runtime, publish, flush }
}

type UpdatedFrame = RuntimeMobileSessionTabsResult & { type: 'updated' }
type CensusFrame = { type: 'snapshots'; snapshots: RuntimeMobileSessionTabsResult[] }

function isUpdatedFrame(event: unknown): event is UpdatedFrame {
  return typeof event === 'object' && event !== null && 'type' in event && event.type === 'updated'
}

function isCensusFrame(event: unknown): event is CensusFrame {
  return (
    typeof event === 'object' && event !== null && 'type' in event && event.type === 'snapshots'
  )
}

function updates(emit: ReturnType<typeof vi.fn>): UpdatedFrame[] {
  return emit.mock.calls.map(([event]) => event).filter(isUpdatedFrame)
}

describe('session.tabs.subscribeAll renderer restatement', () => {
  it('sends one frame when the renderer restates what main already published', async () => {
    const { runtime, publish, flush } = createRuntime()
    publish([snapshot(1)])
    const emit = await subscribeInventory(runtime, 'a')

    runtime.touchMobileSessionTabsForWorktree(WT)
    flush()
    publish([snapshot(17)])
    flush()

    expect(updates(emit).map((frame) => frame.snapshotVersion)).toEqual([2])
  })

  it('still delivers a restatement that changes this client payload', async () => {
    const { runtime, publish, flush } = createRuntime()
    publish([snapshot(1)])
    const emit = await subscribeInventory(runtime, 'b')

    publish([snapshot(5, 'Renamed')])
    flush()

    expect(updates(emit).map((frame) => frame.tabs[0]?.title)).toEqual(['Renamed'])
  })

  // Why: status heartbeats and PTY title touches renew a client's freshness lease; they are
  // main-local edges and must ship even when nothing in the payload changed.
  it('never drops a main-local touch, alone or coalesced with a restatement', async () => {
    const { runtime, publish, flush } = createRuntime()
    publish([snapshot(1)])
    const emit = await subscribeInventory(runtime, 'c')

    runtime.touchMobileSessionTabsForWorktree(WT)
    flush()
    publish([snapshot(3)])
    runtime.touchMobileSessionTabsForWorktree(WT)
    flush()
    runtime.touchMobileSessionTabsForWorktree(WT)
    publish([snapshot(9)])
    flush()

    expect(updates(emit)).toHaveLength(3)
  })

  it('gives a subscriber that joins after a dropped restatement the current snapshot', async () => {
    const { runtime, publish, flush } = createRuntime()
    publish([snapshot(1, 'Old')])
    await subscribeInventory(runtime, 'd')
    publish([snapshot(4, 'New')])
    flush()

    const late = await subscribeInventory(runtime, 'e')
    const census = late.mock.calls.map(([event]) => event).find(isCensusFrame)
    expect(census?.snapshots.map((frame) => frame.tabs[0]?.title)).toEqual(['New'])
  })
})

describe('session.tabs.subscribe renderer restatement', () => {
  function frame(version: number, activeTabId = 'tab-1'): RuntimeMobileSessionTabsResult {
    return {
      worktree: WT,
      publicationEpoch: 'renderer:epoch',
      snapshotVersion: version,
      activeGroupId: null,
      activeTabId,
      activeTabType: null,
      tabs: []
    }
  }

  async function subscribe() {
    let listener: MobileSessionTabsChangeListener | undefined
    const fixture = {
      getRuntimeId: () => 'test-runtime',
      getClientSettings: () => ({}),
      listMobileSessionTabs: vi.fn().mockResolvedValue(frame(8)),
      registerSubscriptionCleanup: vi.fn(),
      onMobileSessionTabsChanged: vi.fn((next: MobileSessionTabsChangeListener) => {
        listener = next
        return () => {}
      })
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: session.tabs.subscribe reaches only these runtime members.
    const runtime = fixture as unknown as DolphinRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: SESSION_TAB_METHODS })
    const messages: { type: string; snapshotVersion: number }[] = []
    await dispatcher.dispatchStreaming(
      {
        id: 'req-1',
        authToken: 'tok',
        method: 'session.tabs.subscribe',
        params: { worktree: `id:${WT}` }
      },
      (message) => messages.push(JSON.parse(message).result),
      { clientKind: 'runtime' }
    )
    return { messages, deliver: listener! }
  }

  it('drops a version-only restatement and keeps every other frame', async () => {
    const { messages, deliver } = await subscribe()

    deliver(frame(17), 1, { rendererRestatement: true })
    deliver(frame(18), 2)
    deliver(frame(19, 'tab-2'), 3, { rendererRestatement: true })
    deliver(frame(20, 'tab-2'), 4, { rendererRestatement: true })

    expect(messages.map((message) => [message.type, message.snapshotVersion])).toEqual([
      ['snapshot', 8],
      ['updated', 18],
      ['updated', 19]
    ])
  })
})
