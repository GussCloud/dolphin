import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../shared/stable-pane-id'
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

describe('connectPanePty', () => {
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

  type ReattachReply = 'contentless' | 'expired' | 'cold-restore'

  // Drives one pane mount over a dead daemon session and returns every connect call.
  async function mountSleptClaudePane(args: {
    record: Record<string, unknown> | null
    reattach: ReattachReply
    restoredPtyId: string | null
  }): Promise<Record<string, unknown>[]> {
    const pendingTimeouts: (() => void)[] = []
    const originalSetTimeout = globalThis.setTimeout
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the pane only queues callbacks; the timer handle is never read.
    globalThis.setTimeout = vi.fn((fn: () => void) => {
      pendingTimeouts.push(fn)
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: opaque handle, never passed to clearTimeout here.
      return 999 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout
    try {
      const { connectPanePty } = await import('./pty-connection')
      const paneKey = makePaneKey('tab-1', LEAF_2)
      let activePtyId: string | null = args.restoredPtyId
      const transport = createMockTransport(args.restoredPtyId ?? 'fresh-resume-pty')
      transport.getPtyId.mockImplementation(() => activePtyId)
      transport.disconnect.mockImplementation(() => {
        activePtyId = null
      })
      transport.connect.mockImplementation(async (opts: { sessionId?: string }) => {
        if (opts.sessionId) {
          activePtyId = opts.sessionId
          if (args.reattach === 'expired') {
            return {
              id: opts.sessionId,
              isReattach: true,
              sessionExpired: true
            }
          }
          if (args.reattach === 'cold-restore') {
            return {
              id: 'cold-pty',
              coldRestore: {
                scrollback: 'previous claude screen',
                cwd: '/tmp/wt-1'
              }
            }
          }
          return { id: opts.sessionId, isReattach: true }
        }
        activePtyId = 'fresh-resume-pty'
        const onPtySpawn = createdTransportOptions[0]?.onPtySpawn
        if (typeof onPtySpawn === 'function') {
          onPtySpawn('fresh-resume-pty')
        }
        return 'fresh-resume-pty'
      })
      transportFactoryQueue.push(transport)
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: fixture tabs/records carry only the fields the pane reads.
      mockStoreState = {
        ...mockStoreState,
        tabsByWorktree: {
          'wt-1': [{ id: 'tab-1', ptyId: args.restoredPtyId }]
        },
        settings: { ...mockStoreState.settings, agentCmdOverrides: {} },
        agentStatusByPaneKey: {},
        sleepingAgentSessionsByPaneKey: args.record
          ? {
              [paneKey]: {
                paneKey,
                tabId: 'tab-1',
                worktreeId: 'wt-1',
                ...args.record
              }
            }
          : {}
      } as StoreState
      const deps = createDeps({
        restoredLeafId: LEAF_2,
        ...(args.restoredPtyId ? { restoredPtyIdByLeafId: { [LEAF_2]: args.restoredPtyId } } : {})
      })
      vi.mocked(window.api.pty.declarePendingPaneSerializer)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)

      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: shared pane/manager/deps fakes implement what connectPanePty touches.
      connectPanePty(createPane(2) as never, createManager(2) as never, deps as never)
      await flushAsyncTicks(20)
      for (const fn of pendingTimeouts) {
        fn()
      }
      await flushAsyncTicks(10)
      return transport.connect.mock.calls.map(([opts]): Record<string, unknown> => opts)
    } finally {
      globalThis.setTimeout = originalSetTimeout
    }
  }

  const claudeRecord = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    agent: 'claude',
    providerSession: { key: 'session_id', id: 'claude-session-1' },
    prompt: 'finish the task',
    capturedAt: 1,
    updatedAt: 1,
    ...overrides
  })
  const RESUME = /^claude .*--resume.*claude-session-1/

  // Scenario A: manual workspace sleep of a finished Claude pane, then wake on desktop.
  it('A: wakes a manually slept done Claude pane with --resume after a contentless reattach', async () => {
    const calls = await mountSleptClaudePane({
      record: claudeRecord({
        state: 'done',
        origin: 'worktree-sleep',
        restoreOnTabOpenOnly: true
      }),
      reattach: 'contentless',
      restoredPtyId: 'slept-session'
    })
    expect(calls.at(-1)?.sessionId).toBeUndefined()
    expect(calls.at(-1)?.command).toMatch(RESUME)
    expect(mockStoreState.clearSleepingAgentSession).toHaveBeenCalled()
  })

  it('A: wakes a manually slept working Claude pane with --resume when the session expired', async () => {
    const calls = await mountSleptClaudePane({
      record: claudeRecord({ state: 'working', origin: 'worktree-sleep' }),
      reattach: 'expired',
      restoredPtyId: 'slept-session'
    })
    expect(calls.at(-1)?.command).toMatch(RESUME)
  })

  it('A: resumes a slept Claude pane whose layout lost its PTY binding (fresh spawn)', async () => {
    const calls = await mountSleptClaudePane({
      record: claudeRecord({
        state: 'done',
        origin: 'worktree-sleep',
        restoreOnTabOpenOnly: true
      }),
      reattach: 'contentless',
      restoredPtyId: null
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.sessionId).toBeUndefined()
    expect(calls[0]?.command).toMatch(RESUME)
  })

  // Scenario B: nothing to resume.
  it('B: a pane with no sleeping record spawns a plain shell', async () => {
    const calls = await mountSleptClaudePane({
      record: null,
      reattach: 'contentless',
      restoredPtyId: null
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.command).toBeUndefined()
  })

  // Scenario C: the daemon died with the app (no quit capture); only the passive live checkpoint
  // written when the turn finished survives.
  it('C: resumes a finished Claude pane from its live checkpoint over a cold-restore payload', async () => {
    const calls = await mountSleptClaudePane({
      record: claudeRecord({ state: 'done', origin: 'live' }),
      reattach: 'cold-restore',
      restoredPtyId: 'dead-daemon-session'
    })
    expect(calls[0]?.sessionId).toBe('dead-daemon-session')
    expect(calls[0]?.command).toMatch(RESUME)
  })

  it('C: resumes a finished Claude pane from its live checkpoint when the session expired', async () => {
    const calls = await mountSleptClaudePane({
      record: claudeRecord({ state: 'done', origin: 'live' }),
      reattach: 'expired',
      restoredPtyId: 'dead-daemon-session'
    })
    expect(calls.at(-1)?.command).toMatch(RESUME)
  })

  it('C: resumes a finished Claude pane from its live checkpoint after a contentless reattach', async () => {
    const calls = await mountSleptClaudePane({
      record: claudeRecord({ state: 'done', origin: 'live' }),
      reattach: 'contentless',
      restoredPtyId: 'dead-daemon-session'
    })
    expect(calls.at(-1)?.command).toMatch(RESUME)
  })
})
