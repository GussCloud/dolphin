import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushAsyncTicks } from './pty-connection-test-async'
import {
  LEAF_2,
  createMockTransport,
  createPane,
  createManager,
  type MockTransport
} from './pty-connection-test-pane-fixtures'
import { buildPaneConnectionDeps } from './pty-connection-test-deps'
import { createInitialStoreState } from './pty-connection-test-store-fixtures'
import type { StoreState } from './pty-connection-test-store-state'
import {
  installTerminalTestGlobals,
  restoreTerminalTestGlobals
} from './pty-connection-test-environment'

let mockStoreState: StoreState
let transportFactoryQueue: MockTransport[] = []

vi.mock('@/runtime/sync-runtime-graph', () => ({ scheduleRuntimeGraphSync: vi.fn() }))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mockStoreState,
    subscribe: () => () => {}
  }
}))
vi.mock('@/lib/agent-status', async (importOriginal) => {
  const { buildAgentStatusModuleMock } = await import('./pty-connection-test-environment')
  return buildAgentStatusModuleMock(await importOriginal<Record<string, unknown>>())
})
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))
function takeQueuedTransport(): MockTransport {
  const nextTransport = transportFactoryQueue.shift()
  if (!nextTransport) {
    throw new Error('No mock transport queued')
  }
  return nextTransport
}
vi.mock('./pty-transport', () => ({ createIpcPtyTransport: vi.fn(takeQueuedTransport) }))
vi.mock('./remote-runtime-pty-transport', () => ({
  createRemoteRuntimePtyTransport: vi.fn(takeQueuedTransport)
}))

describe('remote desktop fit hold released after a reveal', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    transportFactoryQueue = []
    mockStoreState = createInitialStoreState(() => mockStoreState)
    installTerminalTestGlobals()
  })

  afterEach(async () => {
    await restoreTerminalTestGlobals()
  })

  // The reveal's grid fit skips while another desktop's hold is still set; when this
  // pane's claim is confirmed the hold clears, and that must refit the pane even in a
  // window whose animation frames never run (hidden or occluded).
  it('refits the pane to its own grid when its claim is confirmed', async () => {
    ;(globalThis as { document?: Document }).document = {
      visibilityState: 'visible',
      hasFocus: vi.fn(() => true)
    } as unknown as Document
    globalThis.requestAnimationFrame = vi.fn(() => 1)
    const { setFitOverride } = await import('@/lib/pane-manager/mobile-fit-overrides')
    const { connectPanePty } = await import('./pty-connection')
    const ptyId = 'remote:env-1@@terminal-revealed'
    const transport = createMockTransport(ptyId)
    transportFactoryQueue.push(transport)
    const deps = buildPaneConnectionDeps(() => mockStoreState, {
      restoredLeafId: LEAF_2,
      restoredPtyIdByLeafId: { [LEAF_2]: ptyId },
      paneTransportsRef: { current: new Map([[1, createMockTransport('pty-pane-1')]]) }
    })
    const pane = createPane(2)
    const ownGrid = { cols: 37, rows: 46 }
    pane.fitAddon = {
      ...pane.fitAddon,
      fit: vi.fn(() => {
        pane.terminal.resize(ownGrid.cols, ownGrid.rows)
      }),
      proposeDimensions: vi.fn(() => ownGrid)
    } as never
    pane.terminal.resize.mockImplementation((cols, rows) => {
      pane.terminal.cols = cols
      pane.terminal.rows = rows
      for (const [listener] of pane.terminal.onResize.mock.calls) {
        listener({ cols, rows })
      }
    })
    const binding = connectPanePty(pane as never, createManager(2) as never, deps as never)
    await flushAsyncTicks()
    try {
      // Reveal: the host still owns the grid, so the pane is parked at the host's 75x60.
      setFitOverride(ptyId, 'remote-desktop-fit', 75, 60)
      pane.terminal.cols = 75
      pane.terminal.rows = 60
      transport.resize.mockClear()

      setFitOverride(ptyId, 'desktop-fit', ownGrid.cols, ownGrid.rows)
      await flushAsyncTicks()

      expect({ cols: pane.terminal.cols, rows: pane.terminal.rows }).toEqual(ownGrid)
      expect(transport.resize).toHaveBeenCalledWith(ownGrid.cols, ownGrid.rows, { claim: true })
    } finally {
      setFitOverride(ptyId, 'desktop-fit', 0, 0)
      binding.dispose()
    }
  })
})
