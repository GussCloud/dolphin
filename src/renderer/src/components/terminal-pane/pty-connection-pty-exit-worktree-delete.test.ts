import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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

const {
  resetAndRefreshAllTerminalWebglAtlases,
  scheduleTerminalWebglAtlasRecovery,
  scheduleRuntimeGraphSync,
  shouldSeedCacheTimerOnInitialTitle,
  toastInfo,
  notifyCodexPaneBoundForStaleSweep
} = vi.hoisted(() => ({
  resetAndRefreshAllTerminalWebglAtlases: vi.fn(),
  scheduleTerminalWebglAtlasRecovery: vi.fn(),
  scheduleRuntimeGraphSync: vi.fn(),
  shouldSeedCacheTimerOnInitialTitle: vi.fn(() => false),
  toastInfo: vi.fn(),
  notifyCodexPaneBoundForStaleSweep: vi.fn()
}))

let mockStoreState: StoreState
let transportFactoryQueue: MockTransport[] = []
let createdTransportOptions: Record<string, unknown>[] = []
let storeSubscribers: ((state: StoreState) => void)[] = []

vi.mock('@/runtime/sync-runtime-graph', () => ({
  scheduleRuntimeGraphSync
}))

vi.mock('@/lib/pane-manager/pane-manager-registry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resetAndRefreshAllTerminalWebglAtlases
}))

vi.mock('./terminal-webgl-atlas-recovery', () => ({
  scheduleTerminalWebglAtlasRecovery
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mockStoreState,
    subscribe: (listener: (state: StoreState) => void) => {
      storeSubscribers.push(listener)
      return () => {
        storeSubscribers = storeSubscribers.filter((candidate) => candidate !== listener)
      }
    }
  }
}))

vi.mock('@/lib/agent-status', async (importOriginal) => {
  const { buildAgentStatusModuleMock } = await import('./pty-connection-test-environment')
  return buildAgentStatusModuleMock(await importOriginal<Record<string, unknown>>())
})

vi.mock('./cache-timer-seeding', () => ({
  shouldSeedCacheTimerOnInitialTitle
}))

vi.mock('sonner', () => ({
  toast: {
    info: toastInfo
  }
}))

vi.mock('@/lib/codex-stale-pane-sweep', () => ({
  notifyCodexPaneBoundForStaleSweep
}))

// Why: the working→idle test invokes the real useNotificationDispatch hook outside React, so useCallback must pass through (safe suite-wide: no test here renders React).
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return {
    ...actual,
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn
  }
})

vi.mock('./pty-transport', () => ({
  createIpcPtyTransport: vi.fn((options: Record<string, unknown>) => {
    createdTransportOptions.push(options)
    const nextTransport = transportFactoryQueue.shift()
    if (!nextTransport) {
      throw new Error('No mock transport queued')
    }
    return nextTransport
  })
}))

vi.mock('./remote-runtime-pty-transport', () => ({
  createRemoteRuntimePtyTransport: vi.fn(
    (_environmentId: string, options: Record<string, unknown>) => {
      createdTransportOptions.push(options)
      const nextTransport = transportFactoryQueue.shift()
      if (!nextTransport) {
        throw new Error('No mock transport queued')
      }
      return nextTransport
    }
  )
}))

// Why: stub only getEagerPtyBufferHandle so tests can simulate a live eager buffer (adopt path) without standing up the real IPC dispatcher.
vi.mock('./pty-dispatcher', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getEagerPtyBufferHandle: vi.fn(() => undefined)
  }
})

function createDeps(overrides: Record<string, unknown> = {}) {
  return buildPaneConnectionDeps(() => mockStoreState, overrides)
}

describe('connectPanePty exit during a workspace delete', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    transportFactoryQueue = []
    createdTransportOptions = []
    storeSubscribers = []
    mockStoreState = createInitialStoreState(() => mockStoreState)
    installTerminalTestGlobals()
  })

  afterEach(async () => {
    await restoreTerminalTestGlobals()
  })

  function connectExitDuringDelete(): {
    deps: ReturnType<typeof createDeps>
    manager: ReturnType<typeof createManager>
    settleDelete: (deleteState: { isDeleting: boolean; error: string | null }) => void
  } {
    const transport = createMockTransport('tab-pty')
    transportFactoryQueue.push(transport)
    const manager = createManager(1)
    const deps = createDeps({ onPaneProcessDied: vi.fn() })
    return {
      deps,
      manager,
      settleDelete: (deleteState) => {
        mockStoreState = {
          ...mockStoreState,
          deleteStateByWorktreeId: { 'wt-1': { ...deleteState, phase: 'deleting' } }
        }
        for (const listener of storeSubscribers) {
          listener(mockStoreState)
        }
      }
    }
  }

  async function exitWhileDeleting({
    manager,
    deps
  }: ReturnType<typeof connectExitDuringDelete>): Promise<void> {
    const { connectPanePty } = await import('./pty-connection')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: shared fixtures model only the pane/manager/deps surface connectPanePty reads.
    connectPanePty(createPane(1) as never, manager as never, deps as never)
    const onPtyExit = createdTransportOptions[0]?.onPtyExit
    mockStoreState = {
      ...mockStoreState,
      deleteStateByWorktreeId: { 'wt-1': { isDeleting: true, phase: 'deleting' } }
    }
    if (typeof onPtyExit === 'function') {
      onPtyExit('tab-pty', 1)
    }
  }

  it('stays silent when the workspace delete that killed the PTY succeeds', async () => {
    const harness = connectExitDuringDelete()
    await exitWhileDeleting(harness)

    expect(harness.deps.onPaneProcessDied).not.toHaveBeenCalled()
    expect(harness.deps.onPtyExitRef.current).not.toHaveBeenCalled()
    expect(harness.manager.closePane).not.toHaveBeenCalled()

    harness.settleDelete({ isDeleting: false, error: null })
    expect(harness.deps.onPaneProcessDied).not.toHaveBeenCalled()
  })

  it('reports a delete-specific exit when the delete that killed the PTY fails', async () => {
    const harness = connectExitDuringDelete()
    await exitWhileDeleting(harness)

    harness.settleDelete({ isDeleting: false, error: 'workspace has uncommitted changes' })
    harness.settleDelete({ isDeleting: false, error: 'workspace has uncommitted changes' })

    expect(harness.deps.onPaneProcessDied).toHaveBeenCalledTimes(1)
    expect(harness.deps.onPaneProcessDied).toHaveBeenCalledWith({
      paneId: 1,
      exitCode: 1,
      startup: null,
      reason: 'workspace-delete-failed'
    })
  })
})
